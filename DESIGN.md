# Astro Website Editor — Design Plan

## Context

You build Astro templates for clients and deploy them as static sites on Vercel / Cloudflare
Pages. Today, every copy tweak is a developer task. The goal is to let clients edit **text and
images** (plus a bounded set of theme/CSS knobs) directly on a visual preview of their own site,
and have "Save" produce a real git commit via a serverless worker — so the git repo stays the
single source of truth and the normal deploy pipeline does the rest.

The critical requirement driving the design: editing something that lives in a shared Astro
component (e.g. the footer) must propagate to **every page** that uses it.

Explicitly out of scope: this is a website **editor**, not a **builder**. No creating pages, no
rearranging layouts, no arbitrary HTML/CSS/JS.

### The core constraint that shapes everything

Astro components execute at **build time** and compile away to HTML. There is no component tree in
the browser at runtime. This single fact eliminates the two libraries you named:

- **Craft.js** requires a live React tree to drive its canvas. There is nothing to drive — you'd
  have to reimplement every template in React and maintain it in parallel. Non-starter.
- **GrapesJS** is a canvas that *owns* HTML/CSS and *emits* HTML/CSS. Adopting it makes GrapesJS
  project JSON the source of truth and demotes your `.astro` components to a one-time import.
  Component propagation — your footer requirement — is precisely what it cannot do, and pushing
  arbitrary HTML back into `.astro` is the "HTML → normalization engine" problem its own community
  flags. (Its Studio SDK added a React renderer in 2025, but Astro components aren't React.)

The workable shape is an **overlay editor, not a canvas editor**: render the *real* site in an
iframe, overlay edit affordances on annotated regions, and have edits mutate a **structured content
store** rather than HTML. This is the same architecture Stackbit/Netlify Create and
CloudCannon/Bookshop converged on. A rich WYSIWYG editor still earns its place — but scoped to the
*richtext field*, via TipTap/ProseMirror, not the whole page.

Component propagation then falls out for free: the footer's copy lives in one data file that
`Footer.astro` reads, so editing that file changes every page. No AST surgery on `.astro` sources —
which also sidesteps `@astrojs/compiler`'s documented caveat that node position data is
"currently incomplete and in some cases incorrect."

### Decisions taken

| Decision | Choice |
|---|---|
| Templates | Refactor so editable copy lives in content/data files; components emit `data-ed` annotations |
| Build vs adopt | Build in-house, reusable across all client sites |
| Preview | Optimistic DOM patching (instant) + branch preview builds for true render. **Site stays 100% static** — no adapter, no SSR route |
| Auth & tenancy | Multi-tenant: one editor + one worker for all sites; own auth; GitHub App holds repo credentials |

---

## Architecture

```
┌──────────────────────────┐         ┌──────────────────────────────┐
│  editor.youragency.com   │postMsg  │  edit deployment (per site)  │
│  (React SPA)             │◄───────►│  branch: editor-draft        │
│  ├ nav: documents        │ iframe  │  EDITOR_MODE=1, noindex      │
│  ├ preview iframe        │         │  ships bridge.js + data-ed   │
│  └ schema-driven fields  │         └──────────────────────────────┘
└────────────┬─────────────┘                        ▲
             │ HTTPS (JWT)                          │ build
             ▼                                      │
┌──────────────────────────┐   Git Data API   ┌─────┴──────────┐   FF merge   ┌────────────┐
│  Cloudflare Worker       │─────────────────►│  editor-draft  │─────────────►│    main    │
│  auth · validate · commit│   (GitHub App)   └────────────────┘              │ production │
└──────────────────────────┘                                                  └────────────┘
```

**Two deployments per client repo, one codebase:**
- `main` → production, `EDITOR_MODE` unset → output is byte-identical to a site with no editor.
- `editor-draft` → edit deployment at a stable URL, `EDITOR_MODE=1`, `noindex`, gated behind
  Cloudflare Access or a shared secret so drafts aren't publicly crawlable. **This is what the
  iframe points at.**
- Publish = fast-forward `main` to `editor-draft`.

---

## Repo layout

```
packages/
  schema/    @astro-editor/schema   Zod field types, doc parse/serialize   (shared by all 3)
  astro/     @astro-editor/astro    Astro integration, ed() helper, bridge.js
  editor/    @astro-editor/editor   React + Vite SPA
  worker/    @astro-editor/worker   Cloudflare Worker (Hono)
examples/
  demo-site/                        reference Astro template, fully wired
```

pnpm workspaces. `schema` is the contract every other package depends on — get it right first.

---

## 1. `@astro-editor/schema` — the contract

Each client repo carries an `editor.config.ts` at its root, versioned alongside the template:

```ts
import { defineSite, f } from '@astro-editor/schema';

export default defineSite({
  name: 'Acme Corp',
  documents: {
    footer: {
      label: 'Footer',
      file: 'src/data/footer.yaml',
      format: 'yaml',
      global: true,                    // → editor shows "appears on every page"
      fields: {
        tagline: f.text({ label: 'Tagline', max: 120 }),
        links: f.list({ label: 'Links', max: 6, of: { text: f.text(), href: f.url() } }),
      },
    },
    homepage: {
      label: 'Home page',
      file: 'src/content/pages/home.md',
      format: 'markdown',              // frontmatter + body
      previewPath: '/',                // where the iframe navigates to edit it
      fields: {
        title: f.text({ label: 'Headline' }),
        hero:  f.image({ label: 'Hero image', maxWidth: 2400 }),
        body:  f.richtext({ allow: ['bold','italic','link','h2','h3','ul','ol'] }),
      },
    },
  },
  theme: {
    file: 'src/data/theme.json',
    tokens: {
      '--color-brand': f.color({ label: 'Brand colour' }),
      '--font-body':   f.select({ label: 'Body font', options: [/* allowlist */] }),
      '--radius':      f.length({ label: 'Corner radius', min: 0, max: 24, unit: 'px' }),
    },
  },
});
```

**Field types — deliberately small:** `text`, `longtext`, `richtext`, `image`, `url`, `select`,
`boolean`, `number`, `color`, `length`, `list`, `group`.

`list` is the *only* structural affordance (add/remove/reorder within a bounded, schema-defined
shape — needed for nav links, testimonials, cards). Everything else is code.

### Serialization is a first-class concern

Naive `yaml.stringify(obj)` reorders keys and destroys comments, so every save produces a huge noisy
diff. Instead use the `yaml` package's **Document API**: parse to a Document, `setIn()` the changed
paths, `toString()`. Same for Markdown frontmatter — and leave the body bytes untouched unless the
body field actually changed.

**Hard invariant, enforced in CI:** `serialize(parse(raw)) === raw` for every fixture, byte for byte.
If that test is green, your git history stays reviewable.

Richtext stores markdown in the file; TipTap in the editor is restricted to exactly the marks/nodes
in `allow`, so the round-trip stays honest.

---

## 2. `@astro-editor/astro` — site-side runtime

```js
// astro.config.mjs
import editor from '@astro-editor/astro';
export default defineConfig({ integrations: [editor()] });
```

The integration:
- Loads and validates `editor.config.ts`; **fails the build** if a referenced file is missing
  (catches template/config drift immediately rather than at edit time).
- Detects edit mode from `EDITOR_MODE=1`.
- Edit mode only: injects `bridge.js` via `injectScript('page')`, adds `<meta name="robots"
  content="noindex">`, and emits the resolved config as a static asset at `/_ed/config.json`.
- Production: `ed()` returns `{}`, no bridge, no config asset → zero footprint.

### The `ed()` helper

```astro
---
import { ed } from '@astro-editor/astro/runtime';
import footer from '../data/footer.yaml';
---
<footer>
  <p {...ed('footer.tagline')}>{footer.tagline}</p>
  <ul>
    {footer.links.map((l, i) => (
      <li><a href={l.href} {...ed(`footer.links[${i}].text`)}>{l.text}</a></li>
    ))}
  </ul>
</footer>
```

Returns `{ 'data-ed': path }` in edit mode, `{}` otherwise. **No wrapper elements** — it spreads onto
the element that already exists, so annotating a template never changes its layout.

This is the whole propagation mechanism: `Footer.astro` is imported by every page, so every page
carries `data-ed="footer.tagline"`, and one edit patches all of them at once.

### `bridge.js` (~300 lines, no framework, edit builds only)

- On load: walk `[data-ed]` → `Map<path, Element[]>` → post `ed:ready {paths, url}` to parent.
- Listen for `ed:patch {path, value, kind}` → set `textContent` / `src` / `href` / CSS custom
  property. Richtext sets `innerHTML` from HTML the parent rendered and sanitized (same sanitizer
  both sides — never inject unsanitized HTML into the client's frame).
- Hover/click on annotated elements → post `ed:focus {path, rect}`; the parent draws the highlight
  overlay in **its own** coordinate space, so no editor chrome is ever injected into the client's page.
- Intercept `<a>` clicks → post `ed:navigate {href}` so the parent drives the iframe and owns history.
- `ResizeObserver` + `MutationObserver` keep rects fresh.
- Strict `event.origin` allowlist both ends + a per-session nonce in the iframe URL fragment.

The iframe is **cross-origin** (`editor.youragency.com` → `draft-acme.pages.dev`), so all
communication is postMessage-only by construction — no same-origin requirement, and the edit
deployment needs a `frame-ancestors` CSP permitting the editor origin.

### Theme tokens get the best preview of all

The integration emits `<style>:root{--color-brand:#…}</style>` from `theme.json`. The bridge patches
it live via `documentElement.style.setProperty()` — CSS custom properties genuinely cascade, so
colour/spacing/radius edits are **pixel-accurate and instant**, not approximations.

---

## 3. `@astro-editor/editor` — the SPA

React + Vite at `editor.youragency.com`. Three panes: document nav (grouped **This page** /
**Site-wide**) · preview iframe with device-width toggle · schema-generated field panel.

- Field panel is **generated entirely from the schema** — one renderer per field type, zero per-site
  UI code. This is what makes the tool reusable across every client.
- Single draft store `{ docId: {data, body} }` + `baseSha`; every edit derives a patch and
  postMessages it to the iframe. Undo/redo via a command stack (clients ask for this on day one).
- **Site-wide warning**: selecting a field on a `global: true` document shows "This appears on every
  page" inline. The client should understand blast radius before changing the footer.
- **Two buttons**: *Save draft* → commit to `editor-draft`. *Publish* → fast-forward `main`.
  Autosave goes to the worker's KV every few seconds so nothing is lost, but **git commits only
  happen on explicit Save** — otherwise the history becomes unusable.
- After Save, poll the worker for deploy status and reload the iframe when the new build is live;
  show an honest "preview rebuilding…" chip during the ~30–60s gap.
- Images: drag-drop → client-side canvas downscale to `maxWidth` for a fast upload → worker
  re-encodes → returns repo path.

**Known fidelity gap, worth stating plainly:** Astro's `<Image>` produces hashed, optimized files at
build time. An optimistic image swap can only show the raw uploaded blob at a different size/format;
the true optimized render appears after the draft build completes. Text and theme tokens patch
exactly; images approximate until rebuild.

---

## 4. `@astro-editor/worker` — Cloudflare Worker (Hono)

| Route | Purpose |
|---|---|
| `POST /auth/login` | Magic link → short-lived JWT (site id + allowed doc ids); sessions in KV |
| `GET  /sites/:site` | Resolved config, current document contents, `baseSha` |
| `PUT  /sites/:site/draft` | Autosave to KV (no git) |
| `POST /sites/:site/commit` | Validate + commit to `editor-draft` |
| `POST /sites/:site/publish` | Fast-forward `main` |
| `POST /sites/:site/media` | Image upload |
| `GET  /sites/:site/status` | Deployment status passthrough |

### Commit mechanics — Git Data API, not `createOrUpdateFileContents`

`createOrUpdateFileContents` makes **one commit per file** and races on concurrent writes. Instead:

1. `GET /git/ref/heads/editor-draft` → head sha; compare with client's `baseSha` → **409 if moved**.
2. `POST /git/blobs` per changed file (base64 for images).
3. `POST /git/trees` with `base_tree` = head tree, all changed paths → one atomic tree.
4. `POST /git/commits` → `PATCH /git/refs/heads/editor-draft`.

One commit per save, all files together:
`content: update Footer, Home page (via editor, alice@acme.com)`

If `main` has moved (you pushed template changes), the worker merges `main` into `editor-draft`
before committing. Content and code touch disjoint files, so conflicts should be rare; surface them
to you, not the client.

### Security boundary

A bug here writes to a repo that a CI pipeline executes, so treat it as the hard perimeter:

- The worker **re-validates the entire payload against the schema and re-serializes from validated
  data itself**. The client's serialized output is never trusted or written through.
- Writable paths derive **only** from `editor.config.documents[].file` + the media directory. No
  client-supplied path ever reaches the tree builder.
- Deny-list on top of the allow-list, unconditionally: `astro.config.*`, `package.json`,
  `.github/**`, `**/*.astro`, `**/*.ts`, `**/*.js`.
- Images: sniff magic bytes (never extension or `Content-Type`), re-encode through the image
  pipeline, cap dimensions and bytes, strip EXIF, force webp/jpeg output. **Reject SVG outright** —
  it's a script-execution vector with no legitimate use here.
- GitHub App installation scoped to client repos only, `contents: write` and nothing else.
- Per-site commit rate limiting.

### Site registry (worker-side D1/KV, never client-supplied)

`siteId → { repo, editBranch, prodBranch, editOrigin, prodOrigin, installationId, users[] }`

The worker fetches each site's schema from `https://<editOrigin>/_ed/config.json`, with `editOrigin`
pinned in this registry — so config always matches the deployed build, and the repo carries no
generated files.

---

## Phasing

| Phase | Deliverable | Why here |
|---|---|---|
| **P0** | Monorepo; `schema` with field types + parse/serialize + round-trip tests. Demo site: two pages sharing `Footer.astro`, `src/data/footer.yaml`, `editor.config.ts` | The contract everything else depends on |
| **P1** | Worker: GitHub App auth, Git Data API commit, path allowlist, schema validation. **Verified with curl against a scratch repo — no UI at all** | De-risks the scariest part first |
| **P2** | Editor SPA with schema-generated field panel, no iframe. Load → edit → save → commit appears | Already shippable to a tolerant client |
| **P3** | `ed()` helper, `bridge.js`, iframe, hover/click-to-field, optimistic text patching | Where it becomes the thing you actually want |
| **P4** | Images: upload, re-encode, commit, optimistic swap |  |
| **P5** | Theme tokens → CSS custom properties, live patching |  |
| **P6** | Multi-tenant: site registry, magic-link auth, per-site branding, publish flow, deploy status |  |

---

## Verification

**Unit / integration (`pnpm -w test`)**
- Round-trip: `serialize(parse(raw)) === raw` byte-for-byte across ~20 YAML/Markdown fixtures.
- Schema validation rejects out-of-schema payloads (wrong type, over `max`, unknown key).
- Path allowlist: traversal attempts (`../`, absolute paths, encoded separators) and every deny-list
  pattern are rejected.
- Worker via `vitest` + `@cloudflare/vitest-pool-workers`, GitHub API mocked with `msw`.

**Production-parity test** — the one that protects your clients' real sites:
build `examples/demo-site` with and without `EDITOR_MODE=1`; assert the non-edit output contains
zero `data-ed` attributes, no bridge script, and no `/_ed/` asset.

**E2E (Playwright)** — proves the footer requirement end to end:
serve the demo site's edit build locally, open the editor, change `footer.tagline`, assert the text
updates in the iframe **on both pages**, click Save, assert miniflare received exactly one commit
containing `src/data/footer.yaml` with the new value.

**Manual gate before P6**: one real client site through the full loop — edit → draft URL → publish →
production reflects it.

---

## Worth knowing before you commit to P3+

Off-the-shelf options that overlap this design, in case one shortcuts your path:

- **TinaCMS** — closest existing match; added Astro visual editing via `TinaIsland` (draft data →
  island route → HTML swapped into the preview) and dropped the React dependency from its Astro
  starter in 2026. Git-backed, needs its data layer hosted or self-hosted.
- **CloudCannon + Bookshop** — the most polished visual editing for Astro, with a component browser.
  Commercial, per-site pricing.
- **Keystatic** — cleanest Astro integration and a Zod-ish schema very close to the one above, but
  form-based (no in-page visual editing), and `@keystatic/astro@5.0.6` still declares Astro 2–5
  peers, so **it breaks on Astro 6**.
- **Sveltia CMS** — simplest drop-in, git-based, no visual editing.

Spending a day wiring **one** client site to Keystatic or Sveltia would validate the content model
and git workflow cheaply before P3. The custom overlay is the part none of them give you — and it's
also the part that justifies building rather than buying, since the schema-driven field panel
amortizes across every client site you run.
