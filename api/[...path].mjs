import {createHmac, randomBytes, timingSafeEqual} from 'node:crypto';

const clientId = process.env.ROBLOX_CLIENT_ID;
const clientSecret = process.env.ROBLOX_CLIENT_SECRET;
const sessionSecret = process.env.SESSION_SECRET;
const redirectUri = process.env.ROBLOX_REDIRECT_URI;

function json(response, status, body) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(body));
}

function cookieMap(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map(value => {
    const [key, ...rest] = value.trim().split('=');
    return [key, decodeURIComponent(rest.join('='))];
  }));
}

function signedCookie(value) {
  const signature = createHmac('sha256', sessionSecret || 'missing-secret').update(value).digest('base64url');
  return `${value}.${signature}`;
}

function readSession(request) {
  if (!sessionSecret) return null;
  const raw = cookieMap(request).orbit_profile;
  if (!raw) return null;
  const split = raw.lastIndexOf('.');
  if (split < 1) return null;
  const value = raw.slice(0, split);
  const actual = Buffer.from(raw.slice(split + 1));
  const expected = Buffer.from(createHmac('sha256', sessionSecret).update(value).digest('base64url'));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try { return JSON.parse(Buffer.from(value, 'base64url').toString()); } catch { return null; }
}

function setCookie(response, name, value, maxAge) {
  response.setHeader('set-cookie', `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=${maxAge}`);
}

async function robloxJson(url, options) {
  const result = await fetch(url, options);
  if (!result.ok) throw new Error(`Roblox API returned ${result.status}`);
  return result.json();
}

function routeOf(request) {
  const pathname = new URL(request.url, `https://${request.headers.host}`).pathname;
  return pathname.replace(/^\/api/, '') || '/';
}

export default async function handler(request, response) {
  const route = routeOf(request);
  const url = new URL(request.url, `https://${request.headers.host}`);
  try {
    if (route === '/auth/login') {
      if (!clientId || !clientSecret || !redirectUri || !sessionSecret) return json(response, 500, {error: 'Vercel environment variables are not configured.'});
      const state = randomBytes(24).toString('hex');
      setCookie(response, 'orbit_oauth_state', state, 600);
      const authorize = new URL('https://apis.roblox.com/oauth/v1/authorize');
      authorize.search = new URLSearchParams({client_id: clientId, response_type: 'code', redirect_uri: redirectUri, scope: 'openid profile', state});
      response.statusCode = 302;
      response.setHeader('location', authorize);
      return response.end();
    }
    if (route === '/auth/callback') {
      const cookies = cookieMap(request);
      const state = url.searchParams.get('state');
      const code = url.searchParams.get('code');
      if (!state || state !== cookies.orbit_oauth_state || !code) return json(response, 400, {error: 'Invalid OAuth callback state.'});
      const token = await robloxJson('https://apis.roblox.com/oauth/v1/token', {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri})});
      const profile = await robloxJson('https://apis.roblox.com/oauth/v1/userinfo', {headers: {authorization: `Bearer ${token.access_token}`} });
      const value = Buffer.from(JSON.stringify({id: profile.sub, name: profile.preferred_username || profile.name || 'Roblox player'})).toString('base64url');
      setCookie(response, 'orbit_profile', signedCookie(value), 604800);
      response.statusCode = 302;
      response.setHeader('location', '/');
      return response.end();
    }
    if (route === '/session') return json(response, 200, {oauthConfigured: Boolean(clientId && clientSecret && redirectUri && sessionSecret), authenticated: Boolean(readSession(request)), profile: readSession(request)});
    if (route === '/experiences') {
      const session = readSession(request);
      if (!session) return json(response, 401, {error: 'Connect Roblox first.'});
      const userId = encodeURIComponent(session.id);
      const [favorites, created] = await Promise.allSettled([
        robloxJson(`https://games.roblox.com/v2/users/${userId}/favorite/games?sortOrder=Asc&limit=50`),
        robloxJson(`https://games.roblox.com/v2/users/${userId}/games?accessFilter=Public&sortOrder=Asc&limit=50`)
      ]);
      return json(response, 200, {favorites: favorites.status === 'fulfilled' ? favorites.value.data : [], created: created.status === 'fulfilled' ? created.value.data : []});
    }
    return json(response, 404, {error: 'Not found'});
  } catch (error) { return json(response, 502, {error: error.message}); }
}