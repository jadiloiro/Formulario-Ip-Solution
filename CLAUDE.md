# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

IP Solution's onboarding tool: a multi-step survey form (client queues, agents, hours, BOT config) plus a visual chatbot-flow editor (Drawflow), backed by a small NestJS API. Code, comments and UI text are in Portuguese (pt-BR) — match that when editing.

## Commands

There are no lint or test scripts defined in `package.json` — don't assume `npm test`/`npm run lint` exist.

Server runs at `http://localhost:3000`. The frontend is served directly from `backend/public/` by the same Nest process (`ServeStaticModule`), so there is no separate frontend dev server and no build step for the frontend — HTML/CSS/JS in `public/` are edited and served as-is.

## Architecture

### Backend (`backend/src/`)
NestJS app, single feature module:
- `app.module.ts` wires together `TypeOrmModule.forRoot({ type: 'sqlite', database: 'data/ipsolution.db', autoLoadEntities: true, synchronize: true })` and `ServeStaticModule.forRoot({ rootPath: 'public' })`. To switch to Postgres/MySQL in production, this is the only block that needs to change.
- `main.ts`: CORS enabled globally, global `ValidationPipe({ whitelist: true, transform: true })`, and `app.setGlobalPrefix('api', { exclude: [''] })` — so `/` still serves the static frontend but all controller routes live under `/api/*`.
- `submissions/` is the only domain module: one entity (`Submission`) with `formData` and `flowData` stored as `simple-json` blobs (no normalized schema — the form's shape lives in the frontend, not in migrations). `status` is `'rascunho' | 'enviado'`.
- `GET /api/submissions/current` is the key endpoint the frontend treats as its "session": it returns the most recent draft (`rascunho`) or creates an empty one. There's no auth/user concept — one global pool of submissions.
- `PUT /api/submissions/:id/flow` saves only the Drawflow graph (`flowData`), separate from the general `PATCH /api/submissions/:id` used for form fields.
- `POST /api/submissions/:id/submit` flips status to `enviado` — the only state transition modeled.

### Frontend (`backend/public/`)
Plain HTML/CSS/JS, no framework, no bundler. Libraries (Drawflow, docx, Font Awesome) are loaded from CDN in the HTML `<head>`, not via npm.
- `index.html` + `script.js` + `style.css`: the 7-step onboarding form (`currentStep`/`totalSteps` in `script.js`). Step definitions, validation (`validateStep`), draft collection (`collectDraft`) and restoration (`restoreDraft`) all live in this one large `script.js` file.
- `Flowchart.html` + `Flowchart.js` + `Flowchart.css` (referenced from HTML in lowercase — relies on Windows' case-insensitive filesystem; watch for this if ever deployed on Linux/case-sensitive storage): a separate page hosting a Drawflow instance that builds the chatbot's action-block flow from the queues/agents captured in the main form.
- **Dual online/offline mode** (`script.js`, top of file, `apiCtx`/`initApiSync`): on load, the frontend pings `GET /api/health`; if it responds, it fetches/creates a submission via `/api/submissions/current` and mirrors all further changes to the API (`pushDraftToApi`, `PUT .../flow`, `POST .../submit`). If the API is unreachable (e.g. the HTML is opened straight from disk, or the backend is down), everything keeps working purely off `localStorage` (`STORAGE` keys: `currentStep`, `theme`, `ipsolution_form_draft`, `ipsolution_shared_flow_data`; flow graph under `ipsolution_flow_v2`). **Any new persistence feature needs to handle both paths** — localStorage is the source of truth locally, the API call is best-effort and swallows failures.
- Document generation (`gerarDocumentoLevantamento`) builds a `.docx` client-side from the collected draft using the `docx` CDN library.

## Repo hygiene gotchas

- There is no `.gitignore` anywhere in the repo. `backend/node_modules/` and `backend/dist/` are committed, and the runtime SQLite file `backend/data/ipsolution.db` is tracked in git too (it shows up modified after any local run). Be deliberate about what you `git add` — don't assume the usual ignore patterns apply.
