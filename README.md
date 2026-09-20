# Orbit Roblox Launcher

## Local integration

Orbit is a PWA launcher with a small Node server for Roblox OAuth. It never receives a Roblox password. The browser is redirected to Roblox, then the server exchanges the authorization code and stores only a short-lived in-memory session.

1. Create a Roblox OAuth application in the Roblox Creator dashboard.
2. Set its redirect URL to `http://localhost:4173/auth/callback` for local development.
3. Copy `.env.example` to `.env` and fill in the client ID, client secret, and a long random `SESSION_SECRET`.
4. Run `npm start` and open `http://localhost:4173`.

## Vercel deployment

Import this repository into Vercel. Add `ROBLOX_CLIENT_ID`, `ROBLOX_CLIENT_SECRET`, `ROBLOX_REDIRECT_URI`, and `SESSION_SECRET` as production environment variables. Set `ROBLOX_REDIRECT_URI` to `https://your-project.vercel.app/auth/callback`, add that exact URL to the Roblox OAuth application, then redeploy. The `api/[...path].mjs` function handles OAuth and API requests while the static PWA files are served by Vercel.

The launcher requests `openid profile`. After login it loads public favorites and public experiences from the Roblox Games API. Private or restricted account data is not exposed by this integration.