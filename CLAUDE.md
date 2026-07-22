# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

IP Solution's onboarding tool: a multi-step survey form (client queues, agents, hours, BOT config) plus a visual chatbot-flow editor (Drawflow), backed by a small NestJS API. Code, comments and UI text are in Portuguese (pt-BR) — match that when editing.

## Commands

`npm test` (unit, Jest, mocked repositories), `npm run test:e2e` (supertest against a real Postgres — needs one reachable, see below), and `npm run lint` (ESLint flat config) all exist in `backend/package.json`.

Server runs at `http://localhost:3000`. The frontend is served directly from `backend/public/` by the same Nest process (`ServeStaticModule`), so there is no separate frontend dev server and no build step for the frontend — HTML/CSS/JS in `public/` are edited and served as-is.

Needs a running Postgres — either `docker compose up -d postgres` (repo root) or your own instance, configured via `backend/.env` (copy from `backend/.env.example`). Migrations run automatically on boot (`migrationsRun: true`); to manage them manually: `npm run migration:generate -- src/migrations/Name`, `npm run migration:run`, `npm run migration:revert`.

## Architecture

### Backend (`backend/src/`)
NestJS app, single feature module:
- `app.module.ts` wires `TypeOrmModule.forRootAsync` (options from `src/config/database.config.ts`'s `buildDataSourceOptions()`, reading `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_DATABASE` env vars) and `ServeStaticModule.forRoot({ rootPath: 'public' })`. Postgres only — `synchronize` is `false`; schema changes go through TypeORM migrations in `src/migrations/`, applied automatically on boot (`migrationsRun: true`). `src/data-source.ts` is the standalone `DataSource` the TypeORM CLI uses for `npm run migration:generate/run/revert` (reuses the same `buildDataSourceOptions()`, loads `.env` itself since it runs outside Nest's DI).
- `main.ts`: CORS enabled globally, global `ValidationPipe({ whitelist: true, transform: true })`, and `app.setGlobalPrefix('api', { exclude: [''] })` — so `/` still serves the static frontend but all controller routes live under `/api/*`.
- `submissions/` is the only domain module: one entity (`Submission`) with `formData` and `flowData` stored as `simple-json` blobs (no normalized schema — the form's shape lives in the frontend, not in migrations). `status` is `'rascunho' | 'enviado'`.
- `GET /api/submissions/current` is the key endpoint the frontend treats as its "session": it returns the most recent draft (`rascunho`) or creates an empty one. There's no auth/user concept — one global pool of submissions.
- `PUT /api/submissions/:id/flow` saves only the Drawflow graph (`flowData`), separate from the general `PATCH /api/submissions/:id` used for form fields.
- `POST /api/submissions/:id/submit` flips status to `enviado` — the only state transition modeled.

### Frontend (`backend/public/`)
Plain HTML/CSS/JS, no framework, no bundler. Libraries (Drawflow, docx, Font Awesome) are loaded from CDN in the HTML `<head>`, not via npm.
- `index.html` + `script.js` + `style.css`: the 7-step onboarding form (`currentStep`/`totalSteps` in `script.js`). Step definitions, validation (`validateStep`), draft collection (`collectDraft`) and restoration (`restoreDraft`) all live in this one large `script.js` file.
- `Flowchart.html` + `Flowchart.js` + `Flowchart.css`: a separate page hosting a Drawflow instance that builds the chatbot's action-block flow from the queues/agents captured in the main form. Not currently linked from `index.html` — reachable only by navigating to it directly. References must match the files' exact casing (capital `Flowchart.*`) since deploy targets are Linux (case-sensitive filesystem), unlike local Windows dev.
- **Dual online/offline mode** (`script.js`, top of file, `apiCtx`/`initApiSync`): on load, the frontend pings `GET /api/health`; if it responds, it fetches/creates a submission via `/api/submissions/current` and mirrors all further changes to the API (`pushDraftToApi`, `PUT .../flow`, `POST .../submit`). If the API is unreachable (e.g. the HTML is opened straight from disk, or the backend is down), everything keeps working purely off `localStorage` (`STORAGE` keys: `currentStep`, `theme`, `ipsolution_form_draft`, `ipsolution_shared_flow_data`; flow graph under `ipsolution_flow_v2`). **Any new persistence feature needs to handle both paths** — localStorage is the source of truth locally, the API call is best-effort and swallows failures.
- Document generation (`gerarDocumentoLevantamento`) builds a `.docx` client-side from the collected draft using the `docx` CDN library.

## Deployment

Production target is a Debian VM running everything **natively** (no Docker) — Postgres installed via `apt`, the API run directly with Node (`backend/deploy/ipsolution.service` is a systemd unit template: `WorkingDirectory`, `EnvironmentFile` and `User` are placeholders, adjust to the real install path). `DB_HOST=localhost` in `backend/.env` since Postgres and the app share the same machine.

Steps on the VM: `apt install postgresql`, create a role/db, `npm ci && npm run build` in `backend/`, `npm run migration:run` once, then start via the systemd unit (`systemctl enable --now ipsolution`) or `pm2`.

`docker-compose.yml` + `backend/Dockerfile` (repo root / `backend/`) are kept as an alternative — e.g. for spinning up just Postgres locally during development (`docker compose up -d postgres`) without installing it on your machine. They are not the deploy path currently in use.

## Repo hygiene gotchas

- `.gitignore` (repo root) excludes `backend/node_modules/`, `backend/dist/`, `backend/coverage/`, and `.env` files — but they were committed to git history before it existed, so a fresh `git clone` won't have them; `npm install` and copying `.env.example` are still required after cloning.
