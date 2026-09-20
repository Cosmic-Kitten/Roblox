import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4173);
const clientId = process.env.ROBLOX_CLIENT_ID;
const clientSecret = process.env.ROBLOX_CLIENT_SECRET;
const redirectUri = process.env.ROBLOX_REDIRECT_URI || `http://localhost:${port}/auth/callback`;
const sessions = new Map();
const oauthState = new Map();
const scopes = 'openid profile';

function sendJson(response, status, payload) {
  response.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
  response.end(JSON.stringify(payload));
}

function cookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map(value => {
    const [key, ...rest] = value.trim().split('=');
    return [key, decodeURIComponent(rest.join('='))];
  }));
}

function setSession(response, profile) {
  const id = randomBytes(24).toString('hex');
  sessions.set(id, {profile, createdAt: Date.now()});
  response.setHeader('set-cookie', `orbit_session=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
}

async function robloxJson(url, options) {
  const result = await fetch(url, options);
  if (!result.ok) throw new Error(`Roblox API returned ${result.status}`);
  return result.json();
}

async function startLogin(response) {
  if (!clientId || !clientSecret) return sendJson(response, 500, {error: 'Configure ROBLOX_CLIENT_ID and ROBLOX_CLIENT_SECRET first.'});
  const state = randomBytes(24).toString('hex');
  oauthState.set(state, Date.now());
  response.setHeader('set-cookie', `orbit_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`);
  const url = new URL('https://apis.roblox.com/oauth/v1/authorize');
  url.search = new URLSearchParams({client_id: clientId, response_type: 'code', redirect_uri: redirectUri, scope: scopes, state});
  response.writeHead(302, {location: url});
  response.end();
}

async function finishLogin(request, response, requestUrl) {
  const stateCookie = cookies(request).orbit_oauth_state;
  const state = requestUrl.searchParams.get('state');
  const code = requestUrl.searchParams.get('code');
  if (!state || state !== stateCookie || !oauthState.has(state) || !code) return sendJson(response, 400, {error: 'Invalid OAuth callback state.'});
  oauthState.delete(state);
  const token = await robloxJson('https://apis.roblox.com/oauth/v1/token', {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri})});
  const profile = await robloxJson('https://apis.roblox.com/oauth/v1/userinfo', {headers: {authorization: `Bearer ${token.access_token}`} });
  setSession(response, {id: profile.sub, name: profile.preferred_username || profile.name || 'Roblox player', avatar: profile.picture || '', accessToken: token.access_token});
  response.writeHead(302, {location: '/'});
  response.end();
}

function currentSession(request) {
  const session = sessions.get(cookies(request).orbit_session);
  if (!session || Date.now() - session.createdAt > 604800000) return null;
  return session;
}

async function api(request, response, pathname) {
  const session = currentSession(request);
  if (pathname === '/api/session') return sendJson(response, 200, {oauthConfigured: Boolean(clientId && clientSecret), authenticated: Boolean(session), profile: session?.profile ? {...session.profile, accessToken: undefined} : null});
  if (!session) return sendJson(response, 401, {error: 'Connect Roblox first.'});
  if (pathname === '/api/experiences') {
    const userId = encodeURIComponent(session.profile.id);
    const [favorites, created] = await Promise.allSettled([
      robloxJson(`https://games.roblox.com/v2/users/${userId}/favorite/games?sortOrder=Asc&limit=50`),
      robloxJson(`https://games.roblox.com/v2/users/${userId}/games?accessFilter=Public&sortOrder=Asc&limit=50`)
    ]);
    return sendJson(response, 200, {favorites: favorites.status === 'fulfilled' ? favorites.value.data : [], created: created.status === 'fulfilled' ? created.value.data : []});
  }
  sendJson(response, 404, {error: 'Not found'});
}

async function staticFile(response, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = normalize(requestedPath).replace(/^\/+/, '');
  if (safePath.includes('..')) return sendJson(response, 403, {error: 'Forbidden'});
  try {
    let filePath = join(root, safePath);
    try { await readFile(filePath); } catch { filePath = join(root, `${safePath}.html`); }
    const body = await readFile(filePath);
    const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json'};
    response.writeHead(200, {'content-type': types[extname(filePath)] || 'application/octet-stream'});
    response.end(body);
  } catch { sendJson(response, 404, {error: 'Not found'}); }
}

createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = requestUrl.pathname;
  const authPath = pathname.startsWith('/api/auth') ? pathname.replace(/^\/api\/auth/, '/auth') : pathname;
  const callbackPath = pathname.startsWith('/api/callback') ? pathname.replace(/^\/api\/callback/, '/callback') : pathname;
  const normalizedPath = callbackPath === '/callback/auth' ? '/auth/callback' : authPath;
  try {
    if (normalizedPath === '/auth/login') return startLogin(response);
    if (normalizedPath === '/auth/callback' || callbackPath === '/callback/auth') return await finishLogin(request, response, requestUrl);
    if (pathname.startsWith('/api/')) return await api(request, response, pathname);
    await staticFile(response, pathname);
  } catch (error) { sendJson(response, 502, {error: error.message}); }
}).listen(port, () => console.log(`Orbit listening at http://localhost:${port}`));