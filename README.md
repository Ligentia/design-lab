# Design Lab

Internal tool for the Ligentix product design team to centralise, browse, and share UI prototypes and design explorations built with Claude Code.

**Live:** https://design-lab-hazel.vercel.app

---

## What it does

- **Browse prototypes** — card grid with live scaled-down iframe previews, text search, and tag filtering
- **Shareable links** — each prototype has a full-screen detail page at `/prototype/:id` with metadata, an iframe preview, and a one-click copy link
- **Add prototypes via UI** — drag-and-drop an HTML file, fill in the form, and it uploads to GitHub automatically
- **Reference assets** — separate Assets tab for SVGs, HTML templates, and Angular components
- **No server** — GitHub Contents API is the backend; all data lives in `prototypes.json` and `assets.json`

---

## Stack

- Angular 17+ (standalone components, signals, lazy-loaded routes)
- CSS custom properties (SwiftDS-aligned design tokens)
- GitHub Contents API — reads/writes JSON metadata and uploads raw prototype files
- Deployed to Vercel — auto-deploys on every push to `main`

---

## Repo structure

```
design-lab/
├── prototypes.json          — prototype metadata (source of truth)
├── assets.json              — asset metadata (source of truth)
├── prototypes/              — prototype HTML files, one subfolder each
│   └── <folder>/index.html
├── assets/                  — reusable SVG, HTML, Angular files
├── scripts/
│   ├── add-prototype.mjs    — CLI to add a prototype entry
│   └── add-asset.mjs        — CLI to add an asset entry
└── src/
    └── app/
        ├── core/
        │   ├── models/       — Prototype, Asset interfaces + CREATORS constant
        │   └── services/     — GithubService, PrototypeService, AssetService, UiStateService
        └── features/
            ├── dashboard/           — prototype card grid
            ├── prototype-card/      — card with live iframe thumbnail
            ├── prototype-detail/    — shareable full-screen detail page
            ├── add-prototype/       — add/edit modal
            ├── assets/              — assets tab
            ├── asset-card/          — asset card
            └── add-asset/           — add/edit asset modal
```

---

## Adding a prototype

### Via the UI
1. Go to https://design-lab-hazel.vercel.app
2. Click **Add prototype** in the header
3. Enter your GitHub Personal Access Token when prompted (stored for the session)
4. Fill in the fields:
   - **File** — drag-and-drop or browse for the `.html` prototype file
   - **Title** — the folder path auto-fills from the title
   - **Creator** — select from the dropdown or type a new name
   - **Tags** — multi-select from existing tags or add new ones
5. Click **Add prototype** — the file uploads to GitHub and the card appears immediately

### Via CLI
```bash
node scripts/add-prototype.mjs \
  --title "My exploration" \
  --folder "prototypes/my-exploration" \
  --creator "Chuka" \
  --tags "animation,SwiftDS"
```

Then manually copy the HTML file to `prototypes/my-exploration/index.html` and push.

---

## Adding an asset

### Via the UI
Go to the **Assets** tab and click **Add asset**.

### Via CLI
```bash
node scripts/add-asset.mjs \
  --name "Ligentix logo" \
  --file "assets/ligentix-logo.svg" \
  --type svg
```

---

## Local development

```bash
cd design-lab
source ~/.zshrc        # ensure Node is in PATH
npm install
npx @angular/cli serve
```

Open http://localhost:4200. The app reads `prototypes.json` and `assets.json` from the live GitHub repo.

### Building
```bash
npx @angular/cli build
```

Output goes to `dist/design-lab`. Vercel runs this automatically on push.

---

## GitHub config

Repo owner, repo name, and branch are set in `src/environments/environment.ts`:

```typescript
export const environment = {
  githubOwner: 'Ligentia',
  githubRepo: 'design-lab',
  githubBranch: 'main',
};
```

The backend repo is `github.com/Ligentia/design-lab`. The `dshyone/design-lab` repo is kept as a push mirror.

---

## Creators

Current list: **Craig**, **Chuka**, **Adrian** (defined in `src/app/core/models/prototype.model.ts`).

To add a new permanent creator, add their name to the `CREATORS` constant. New names can also be entered ad-hoc in the modal but are session-only.

---

## Team

Ligentix Product Design — Craig Wetherall, Chuka Ezeoke, Adrian
