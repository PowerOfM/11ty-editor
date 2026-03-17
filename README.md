# 11ty Editor

A lightweight, non-technical-friendly CMS for editing any 11ty static site.
Built with React + Firebase Cloud Functions.

```
┌─────────────────────────────────────────────────────┐
│                   Editor Frontend (React)            │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  Form Editor  │  │  GrapesJS    │  │  Raw Code │ │
│  │  (Markdown   │  │  (Layout &   │  │  Editor   │ │
│  │   Fields)    │  │   Styling)   │  │  (Adv.)   │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         └─────────────────┴────────────────┘        │
│                     Change Buffer (Zustand)          │
└─────────────────────────┬───────────────────────────┘
                          │ REST / JSON
┌─────────────────────────▼───────────────────────────┐
│              Firebase Cloud Functions (Node 20)      │
│  Schema Parser → Build Pipeline → GitHub API Push    │
└─────────────────────────────────────────────────────┘
```

## Features

- **Form Editor** — Auto-generated forms from frontmatter fields (text, images, dates, booleans…)
- **Rich Body Editor** — TipTap WYSIWYG for markdown page content
- **Live Preview** — Debounced in-memory 11ty build shown in an iframe
- **Media Manager** — Drag-and-drop image uploads to Firebase Storage
- **Publish** — One-click full 11ty build + push `_site/` to `gh-pages`
- **Advanced / Code Mode** — Raw file editor with direct GitHub commits
- **Site-agnostic** — Works with any 11ty site; configure via `.editor.json`

## Project Structure

```
packages/
├── frontend/     # Vite + React + TypeScript + TailwindCSS
└── backend/      # Firebase Cloud Functions (Express + 11ty)
```

## Quick Start

### Prerequisites

- Node 20+
- Firebase CLI (`npm i -g firebase-tools`)
- A Firebase project with Hosting + Functions + Storage enabled

### 1. Clone and install

```bash
git clone https://github.com/you/11ty-editor
cd 11ty-editor
npm install
```

### 2. Configure Firebase

```bash
# Replace with your project ID
echo '{"projects":{"default":"YOUR_PROJECT_ID"}}' > .firebaserc
firebase login
firebase init  # select Functions, Hosting, Storage
```

### 3. Set environment variables

```bash
cp packages/frontend/.env.example packages/frontend/.env.local
cp packages/backend/.env.example packages/backend/.env
# Edit both files with your values
```

Update `packages/frontend/vite.config.ts` with your project ID for the dev proxy.

### 4. Run locally

```bash
# Terminal 1 — frontend
npm run dev:frontend

# Terminal 2 — backend (emulator)
npm run emulate
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Deploy

```bash
npm run deploy
```

## Making Your 11ty Site Editable

Add a `.editor.json` file to the root of your site repo:

```json
{
  "editableFiles": ["src/**/*.md"],
  "assetDirectory": "src/images",
  "customCssFile": "src/css/_custom.css",
  "publishMode": "output-push",
  "deployBranch": "gh-pages",
  "ignoredFields": ["layout", "permalink"],
  "fieldHints": {
    "title": "Shown in the browser tab and search results",
    "description": "A short summary for search engines (150 chars max)"
  }
}
```

If no `.editor.json` is present, sensible defaults are used and all markdown
frontmatter fields are auto-discovered.

## Roadmap

| Phase | Status | Description |
|---|---|---|
| 1 | ✅ | Form editor, preview, publish, media upload, code editor |
| 2 | Planned | GrapesJS visual layout editor (CSS variables + section order) |
| 3 | Planned | Draft autosave to Firestore + publish history |
| 4 | Planned | Monaco Editor replace textarea in code mode |
| 5 | Planned | Cloudflare Workers / Pages deployment option |

## Security

- GitHub tokens are stored in `sessionStorage` only (never sent to third parties)
- The backend validates tokens by making real GitHub API calls with them
- File uploads are type-checked and filename-sanitised server-side
- CORS is restricted to `ALLOWED_ORIGIN` in production

## License

MIT
