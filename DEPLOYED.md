# What actually runs on Vercel

The Vercel deployment (`gods-eye-view` project, static + serverless) runs a
**subset** of this repo. Everything else is local-dev-only. This file is the
source of truth so the next reader doesn't mistake dev tooling for deploy
surface.

## Runs on Vercel

- **Static Vite SPA** built from `src/` → `dist/` at deploy time.
  `vercel.json` rewrites every non-`/api/*` route to `index.html`.
- **Serverless functions** in `api/`:
  - `api/realtime/token.js` — mints short-lived OpenAI Realtime client
    secrets (needs `OPENAI_API_KEY`; fails closed without it).
  - `api/openai/hud-summary.js` — HUD summaries via OpenAI (needs
    `OPENAI_API_KEY`; serves a keyless fallback without it).
  - `api/flights/index.js` — live aircraft snapshot, keyless:
    adsb.lol → adsb.fi failover, 60s cache, serve-stale-on-error.
    (adsb.lol data is ODbL — attribution in `src/data/dataCredits.js`.)
  - `api/flights/track.js` — 501 by design: track backfill needs OpenSky
    credentials that don't exist on this deploy; the client surfaces it as
    NOT CONFIGURED instead of retry-looping.
- Shared: `api/_lib/vercel-same-site.js` (same-site gate), and the pure
  modules the functions import (`src/localRequestGate.mjs`,
  `src/data/adsbLolFallback.js`).

## Local-dev-only (never executes on Vercel)

- `server/` — the full Express dev server and every provider
  (aircraft OpenSky proxy, vessels/AIS, satellites, quakes, CCTV, Mapillary,
  radio, regional news, overpass, …). Only the modules imported by `api/`
  run in production.
- `server/mcp/` — stdio MCP server for local agents.
- `pinokio/` — desktop installer scripts.
- `build/`, `scripts/`, `tools/`, `docs/`, `config/cctv_sources.*.json`.

## Client behavior on the static deploy

Layers that fetch straight from the browser keep working keyless:
satellites (CelesTrak), earthquakes (USGS), cameras (CORS-open public feeds).
`/api/*` routes with no function return Vercel 404; the client marks those
layers **NOT CONFIGURED** (terminal — no retry loop) via the structural
flag in `src/sources/live/contract.js`.

## Environment variables (Vercel project settings)

| Var | Required for | Without it |
|---|---|---|
| `OPENAI_API_KEY` | voice token + HUD summaries | both degrade gracefully (owner action) |
| `CESIUM_ION_TOKEN` | photorealistic 3D tiles | globe renders without tile detail. **Build-time** var (`build/vite.js` bakes it via `define`) — rotating it requires a redeploy. Keep the ion dashboard URL restriction tight. |
| `GOOGLE_MAPS_API_KEY` | places/geocode paths | those paths degrade |
| `MAPILLARY_CLIENT_TOKEN` | street-level layer | layer degraded |

`api/` functions read env per-request with graceful fallbacks — no
cold-start crashes on missing vars. Vercel Hobby `maxDuration` is set to
30s for the OpenAI functions, 10s for flights (see `vercel.json`).

## Deliberately not ported

- `/api/realtime/debug-log` — voice transcript sink. Do **not** port without
  a privacy review (per War Room GC ruling 2026-10-15).
- `/api/vessels` — ships need a live AIS feed; the only free path is
  aisstream.io, which requires a **free owner key signup** (key → Vercel env,
  server-side only). Defined follow-up, not yet built.
- OpenSky-backed `/api/flights` variants — OpenSky's license is
  non-commercial and operational REST use can require prior written
  agreement. The adsb.lol/adsb.fi port sidesteps this.

## Deploy rules

- Only the repo owner merges to `main`; pushes auto-deploy.
- Production deploys need the owner's explicit approval, every time.
- Keep the deployment non-commercial (OpenSky + TeleGeography
  CC BY-NC-SA terms in `DATA_SOURCES.md`).
