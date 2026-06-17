# Design Lab

Internal tool for the Ligentix product design team (Craig Wetherall, Chuka Ezeoke) to browse, share, and manage UI prototypes and design explorations built with Claude Code.

## Live URL
https://design-lab-hazel.vercel.app (canonical — builds from the Ligentia repo)
`design-lab-rouge.vercel.app` builds from the `dshyone` mirror and is legacy/backup.

## Repo
https://github.com/Ligentia/design-lab (primary). `github.com/dshyone/design-lab` is kept as a push mirror.

## Stack
- Angular 17+ standalone components, signals-based state
- CSS custom properties (SwiftDS-aligned design tokens in `src/styles/tokens.css`)
- GitHub Contents API as backend (no server — reads/writes JSON files in this repo)
- Deployed to Vercel — auto-deploys on every push to `main`

## Architecture
```
GitHub repo (source of truth)
├── prototypes.json   — all prototype metadata
├── assets.json       — all reference asset metadata
├── prototypes/       — prototype files (each in its own subfolder)
└── assets/           — reusable SVGs, templates, components
```

## Routes
- `/` — prototype dashboard (card grid, tag filter, search)
- `/prototype/:id` — full-screen detail page (metadata + iframe preview + shareable link)
- `/assets` — reference assets area (SVGs, HTML templates, Angular components)

## Key files
- `src/app/core/services/github.service.ts` — GitHub API read/write (getPrototypes, savePrototypes, getAssets, saveAssets, uploadFile)
- `src/app/core/services/prototype.service.ts` — signal-based prototype state; addPrototype uploads file then updates JSON
- `src/app/core/services/asset.service.ts` — signal-based asset state
- `src/app/core/services/ui-state.service.ts` — cross-component Add button trigger (triggerAdd$ Subject)
- `src/app/features/dashboard/` — prototype grid; showModal/editingPrototype are signals (required for OnPush)
- `src/app/features/prototype-detail/` — shareable detail page; caches SafeResourceUrl to prevent iframe flicker
- `src/app/features/prototype-card/` — card with live scaled iframe thumbnail; ResizeObserver computes scale = containerWidth/1280
- `src/app/features/assets/` — assets tab
- `src/app/features/add-prototype/` — add/edit prototype modal; drag-and-drop file upload, multi-select tag dropdown, creator combobox
- `src/app/features/add-asset/` — add/edit asset modal
- `src/environments/environment.ts` — GitHub owner/repo/branch config
- `src/index.html` — has `<meta name="dl-shell">` so the detail page can detect when no prototype file exists

## Data models
```typescript
Prototype { id, title, tags[], creator, date, description, folder, thumbnail? }
Asset     { id, name, type, description, file, tags?, addedBy, date }
```

## Adding prototypes
- **Via UI**: Click "Add prototype" in the header. Fields:
  - *File*: drag-and-drop or browse for an `.html` file — uploaded to `<folder>/index.html` on GitHub
  - *Creator*: combobox — select an existing name or type a new one and click `+ Add "…"` to use it inline
  - *Tags*: multi-select dropdown — click to open, check/uncheck existing tags, type to filter, `+ Add "…"` for new ones; dropdown opens upward and scrolls within the list
  - *Folder*: auto-slugified from the title; can be overridden manually
  - Requires a GitHub PAT entered once per session (stored in `sessionStorage` as `dl_github_pat`)
- **Via CLI**: `node scripts/add-prototype.mjs --title "..." --folder "prototypes/..." --tags "..." --creator "Craig"`

## Adding assets
- **Via UI**: "Add asset" button on the Assets tab. Same PAT flow.
- **Via CLI**: `node scripts/add-asset.mjs --name "..." --file "assets/..." --type svg`

## Prototype preview (iframe)
- The detail page and card thumbnails both iframe `window.location.origin/<folder>/index.html` (served from Vercel's static output).
- `angular.json` includes `prototypes/` and `assets/` in the build assets array so files are bundled into the Vercel output.
- `vercel.json` rewrites only extensionless paths to `index.html` (`/((?!.*\..*).*)`), so `.html` prototype files are served directly.
- If no `index.html` exists, Vercel serves the Angular shell. The shell has `<meta name="dl-shell">` so iframes detect it on load and show an empty state instead.
- `SafeResourceUrl` is cached per folder in a `Map` — without this, Angular recreates the object on every change detection cycle, causing the iframe to reload (flicker).

## Card thumbnail scaling
- Each card uses a live scaled-down iframe as its thumbnail (not a static image).
- The iframe is rendered at 1280×720 inside `.iframe-scale`; `ResizeObserver` computes `scale = containerWidth / 1280` so the preview is proportionally correct at any card size.
- `pointer-events: none` on the scale wrapper lets card clicks pass through to the router navigation.
- Cards with no `index.html` show a placeholder icon (same shell detection as the detail page).

## Zoneless change detection — signals for anything mutated outside a sync event
The app runs **zoneless** (no `zone.js` dependency). Change detection only runs on (a) the synchronous portion of a template event handler, (b) signal changes, or (c) an explicit `ChangeDetectorRef.markForCheck()`. Therefore **any state read in a template that is mutated outside a synchronous event handler must be an Angular signal** (or be followed by `markForCheck()`), or the view goes stale until the next unrelated event. This bites in four recurring places:
- **RxJS subscriptions** — e.g. `showModal`/`editingAsset` set from the `triggerAdd$` subject (the trigger originates in the header, outside the tab component). Use signals (see DashboardComponent, AssetsComponent).
- **`async` handlers after the first `await`** — e.g. the add-prototype file drop reads files via `FileReader`/`JSZip`; the assignment lands after CD has already run. Signal or `markForCheck()` (AddPrototypeModalComponent uses `markForCheck()`).
- **Promise callbacks** — e.g. `navigator.clipboard.writeText().then(() => copied.set(true))` for the "Copied!" indicators. Signal.
- **Timers / direct route loads** — `setTimeout`/`setInterval` callbacks, and route components must call `svc.load()` in `ngOnInit` (a deep-link refresh boots straight into that component; nothing else loads the data).

## Creators
Current list in `src/app/core/models/prototype.model.ts`: Craig, Chuka, Adrian.
The creator field in the modal is a combobox — new names can be added inline without editing the model, but they only persist for that session. To make a new creator permanent, add them to the `CREATORS` constant.

## GitHub config
Owner: `Ligentia` | Repo: `design-lab` | Branch: `main`
Set in `src/environments/environment.ts` and `environment.prod.ts`. The `origin` remote pushes to both `Ligentia` and `dshyone` (mirror).

## Deploying
Build: `npx @angular/cli build` (from the `design-lab` directory, with `source ~/.zshrc` to load Node).
Push triggers Vercel auto-deploy. Run push from the `design-lab` directory, not from `~`.

## PRD
Original PRD v0.2 is at `/Users/chukwukaezeoke/Downloads/Design_Lab_PRD_v0.2.docx`
v0 and v1 are shipped. Remaining items tracked in the PRD.

## Open items (as of June 2026)
- ~~Transfer repo to Ligentia GitHub org~~ DONE (2026-06-16): primary is `Ligentia/design-lab`, env files point at Ligentia, canonical site is design-lab-hazel. `dshyone` kept as a git push mirror (origin has both pushurls).
- Creator filter (F-05) and sort controls (F-06) not yet built
- Figma component reference (F-13) — depends on Figma MCP availability
- Auth model for stakeholder sharing (F-15) — TBD
- New creator names added via the combobox are session-only; consider a flow to persist them to the CREATORS constant or to prototypes.json
