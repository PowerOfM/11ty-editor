/**
 * githubClient.ts
 *
 * All GitHub API interactions: reading files, creating commits, pushing the
 * built _site/ output to a deploy branch.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Octokit } from '@octokit/rest';

export interface RepoCoords {
  owner: string;
  repo: string;
}

/** Parse "https://github.com/owner/repo" → { owner, repo } */
export function parseRepoUrl(repoUrl: string): RepoCoords {
  const clean = repoUrl.replace(/\.git$/, '').replace(/\/$/, '');
  const match = clean.match(/github\.com[:/]([^/]+)\/([^/]+)$/);
  if (!match) throw new Error(`Cannot parse GitHub repo URL: ${repoUrl}`);
  return { owner: match[1], repo: match[2] };
}

// ── File reads (for the file-tree / raw editor) ────────────────────────────

export async function getFileContent(
  token: string,
  coords: RepoCoords,
  filePath: string,
  ref = 'HEAD'
): Promise<string> {
  const octokit = new Octokit({ auth: token });
  const { data } = await octokit.repos.getContent({
    ...coords,
    path: filePath,
    ref,
  });
  if (Array.isArray(data) || data.type !== 'file') {
    throw new Error(`${filePath} is not a file`);
  }
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

export async function listFiles(
  token: string,
  coords: RepoCoords,
  dir = '',
  ref = 'HEAD'
): Promise<Array<{ path: string; type: 'file' | 'dir'; size?: number }>> {
  const octokit = new Octokit({ auth: token });
  const { data } = await octokit.repos.getContent({ ...coords, path: dir, ref });
  if (!Array.isArray(data)) return [];
  return data.map((item) => ({ path: item.path, type: item.type as 'file' | 'dir', size: item.size }));
}

// ── Deploy: push _site/ output to a deploy branch ─────────────────────────

export interface DeployResult {
  commitSha: string;
  deployUrl: string;
}

/**
 * Push all files from `outputDir` to `deployBranch` on GitHub.
 * Creates the branch if it doesn't exist (orphan commit).
 */
export async function deployOutputBranch(
  token: string,
  coords: RepoCoords,
  outputDir: string,
  deployBranch: string,
  message = `Deploy from 11ty-editor [${new Date().toISOString()}]`
): Promise<DeployResult> {
  const octokit = new Octokit({ auth: token });
  const { owner, repo } = coords;

  // ── 1. Build a list of blobs from all output files ──────────────────────
  const outputFiles = walkDir(outputDir);

  const treeItems = await Promise.all(
    outputFiles.map(async (absPath) => {
      const relPath = path.relative(outputDir, absPath);
      const content = fs.readFileSync(absPath);
      const isBinary = isBinaryFile(absPath);

      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: isBinary ? content.toString('base64') : content.toString('utf-8'),
        encoding: isBinary ? 'base64' : 'utf-8',
      });

      return {
        path: relPath,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.sha,
      };
    })
  );

  // ── 2. Create the new tree (no base_tree = clean deploy) ─────────────────
  const { data: newTree } = await octokit.git.createTree({ owner, repo, tree: treeItems });

  // ── 3. Determine parent commit (or orphan if branch is new) ──────────────
  let parentShas: string[] = [];
  try {
    const { data: ref } = await octokit.git.getRef({ owner, repo, ref: `heads/${deployBranch}` });
    parentShas = [ref.object.sha];
  } catch {
    // Branch does not exist yet; orphan commit
  }

  // ── 4. Create commit ─────────────────────────────────────────────────────
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: newTree.sha,
    ...(parentShas.length ? { parents: parentShas } : {}),
  });

  // ── 5. Update or create the branch ref ───────────────────────────────────
  if (parentShas.length) {
    await octokit.git.updateRef({ owner, repo, ref: `heads/${deployBranch}`, sha: newCommit.sha });
  } else {
    await octokit.git.createRef({ owner, repo, ref: `refs/heads/${deployBranch}`, sha: newCommit.sha });
  }

  const deployUrl = `https://${owner}.github.io/${repo}/`;
  return { commitSha: newCommit.sha, deployUrl };
}

// ── Source push (Option B: push source, let CI build) ─────────────────────

export async function pushSourceChanges(
  token: string,
  coords: RepoCoords,
  sourceDir: string,
  branch: string,
  message: string
): Promise<string> {
  const { simpleGit } = await import('simple-git');
  const git = simpleGit(sourceDir);
  await git.addConfig('user.email', '11ty-editor@noreply.github.com');
  await git.addConfig('user.name', '11ty-editor');
  await git.add('.');
  const result = await git.commit(message);
  const remoteUrl = coords
    ? `https://oauth2:${token}@github.com/${coords.owner}/${coords.repo}.git`
    : '';
  await git.push(remoteUrl, branch);
  return result.commit;
}

// ── Utilities ──────────────────────────────────────────────────────────────

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full));
    else results.push(full);
  }
  return results;
}

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico',
  '.pdf', '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.zip', '.gz', '.mp4', '.mp3', '.svg',
]);

function isBinaryFile(filePath: string): boolean {
  return BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}
