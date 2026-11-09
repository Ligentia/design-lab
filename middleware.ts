// Vercel Routing Middleware — runs before every request (app shell, JSON, and
// prototype files) and gates the whole site behind a login page + session cookie.
// Credentials come from the BASIC_AUTH_USER / BASIC_AUTH_PASSWORD env vars set
// in the Vercel dashboard. Not run by `ng serve`, so local dev stays open.
//
// Sessions expire after SESSION_HOURS (default 8) regardless of activity. The
// cookie is HMAC-signed with a key derived from the credentials, so changing
// the password in Vercel (and redeploying) logs everyone out.
//
// Public prototypes: files inside the folder of a prototype marked
// `"public": true` in prototypes.json are served without a session (with a
// noindex header). The JSON is bundled at deploy time — every Design Lab save
// commits to main and redeploys, so toggles go live in about a minute.
import { next } from '@vercel/functions';
import prototypes from './prototypes.json' with { type: 'json' };

export const config = {
  matcher: '/:path*',
};

// Edge runtime only exposes env vars referenced as `process.env.NAME` (dot
// access) — bracket access comes through undefined. Typed here so dot access
// passes `noPropertyAccessFromIndexSignature`.
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      BASIC_AUTH_USER?: string;
      BASIC_AUTH_PASSWORD?: string;
      SESSION_HOURS?: string;
    }
  }
}

const COOKIE = 'dl_session';
const DEFAULT_SESSION_HOURS = 8;
const PUBLIC_FOLDERS = publicFolders(prototypes);

export default async function middleware(request: Request): Promise<Response> {
  // Trimmed: values pasted into the Vercel dashboard often carry a stray
  // trailing space or newline, which would make the correct password fail.
  const user = process.env.BASIC_AUTH_USER?.trim();
  const password = process.env.BASIC_AUTH_PASSWORD?.trim();

  // Fail closed: if the env vars are missing, don't silently expose the site.
  if (!user || !password) {
    return new Response('Site protection is not configured.', { status: 503 });
  }

  const url = new URL(request.url);
  const sessionHours = Number(process.env.SESSION_HOURS) || DEFAULT_SESSION_HOURS;

  if (url.pathname === '/logout') {
    return redirect('/login', clearCookie());
  }

  if (url.pathname === '/login') {
    const returnTo = safeReturnPath(url.searchParams.get('next'));

    if (request.method === 'POST') {
      const form = await request.formData();
      const givenUser = String(form.get('username') ?? '').trim();
      const givenPassword = String(form.get('password') ?? '');
      const target = safeReturnPath(String(form.get('next') ?? ''));

      if (safeEqual(givenUser, user) && safeEqual(givenPassword, password)) {
        const expires = Date.now() + sessionHours * 60 * 60 * 1000;
        const token = await sign(String(expires), user, password);
        return redirect(target, sessionCookie(token, sessionHours * 60 * 60));
      }

      // Small delay on failure to slow down password guessing.
      await new Promise((resolve) => setTimeout(resolve, 600));
      return loginPage(target, true);
    }

    // Already signed in — skip the form.
    if (await hasValidSession(request, user, password)) return redirect(returnTo);
    return loginPage(returnTo, false);
  }

  if (isPublicPath(url.pathname, PUBLIC_FOLDERS)) {
    return next({ headers: { 'X-Robots-Tag': 'noindex, nofollow' } });
  }

  if (await hasValidSession(request, user, password)) {
    return next();
  }

  // Page navigations go to the login form; everything else (JSON, scripts,
  // prototype assets) gets a plain 401.
  const accept = request.headers.get('accept') ?? '';
  if (request.method === 'GET' && accept.includes('text/html')) {
    return redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`);
  }
  return new Response('Authentication required.', { status: 401 });
}

// ── Public prototypes ────────────────────────────────────────────────────────

// Folders of prototypes marked public and not archived. Anything that isn't a
// plain "prototypes/<slug>[/<slug>…]" path is ignored, so a bad entry in the
// JSON can never open up "/" or another part of the site.
export function publicFolders(list: unknown): Set<string> {
  const folders = new Set<string>();
  if (!Array.isArray(list)) return folders;
  for (const p of list) {
    if (!p || p.public !== true || p.archived === true || typeof p.folder !== 'string') continue;
    const folder = p.folder.trim().replace(/^\/+|\/+$/g, '');
    const segments = folder.split('/');
    const valid =
      segments.length >= 2 &&
      segments[0] === 'prototypes' &&
      segments.every((s: string) => /^[A-Za-z0-9._-]+$/.test(s) && s !== '.' && s !== '..');
    if (valid) folders.add(folder);
  }
  return folders;
}

// Only real files (last segment has an extension) inside a public folder.
// Extensionless paths are rewritten to the Angular shell by vercel.json, which
// must stay behind sign-in.
export function isPublicPath(pathname: string, folders: Set<string>): boolean {
  // Refuse anything that could climb out of the folder if decoded later
  // (e.g. "/prototypes/pub/..%2Fprivate/index.html").
  if (/%2f|%5c|\\|\.\./i.test(pathname)) return false;
  const last = pathname.slice(pathname.lastIndexOf('/') + 1);
  if (!last.includes('.')) return false;
  for (const folder of folders) {
    if (pathname.startsWith(`/${folder}/`)) return true;
  }
  return false;
}

// ── Session token: "<expiresMs>.<base64url HMAC-SHA256>" ─────────────────────

async function hasValidSession(request: Request, user: string, password: string): Promise<boolean> {
  const token = readCookie(request, COOKIE);
  if (!token) return false;

  const [expires, signature] = token.split('.');
  if (!expires || !signature || Number(expires) < Date.now()) return false;

  const expected = await sign(expires, user, password);
  return safeEqual(token, expected);
}

async function sign(expires: string, user: string, password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`design-lab-session:${user}:${password}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(expires));
  const signature = btoa(String.fromCharCode(...new Uint8Array(mac)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${expires}.${signature}`;
}

// ── Cookies & redirects ──────────────────────────────────────────────────────

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}

function sessionCookie(token: string, maxAgeSeconds: number): string {
  return `${COOKIE}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

function clearCookie(): string {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function redirect(location: string, setCookie?: string): Response {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  if (setCookie) headers.append('Set-Cookie', setCookie);
  return new Response(null, { status: 303, headers });
}

// Only allow same-site relative paths, so ?next= can't bounce users off-site.
function safeReturnPath(path: string | null): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\') || path.startsWith('/login')) {
    return '/';
  }
  return path;
}

// Constant-time comparison so response timing doesn't leak the password.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Login page (self-contained; mirrors src/styles/tokens.css) ───────────────

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function loginPage(returnTo: string, failed: boolean): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Sign in · Design Lab</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px;
      font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #111113; background: #f7f7f8;
      -webkit-font-smoothing: antialiased; }
    .card { width: 100%; max-width: 360px; background: #fff; border: 1px solid #e4e4e7; border-radius: 14px;
      box-shadow: 0 1px 2px rgba(0,0,0,.05), 0 4px 12px rgba(0,0,0,.06); padding: 32px; }
    .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
    .brand-name { font-size: 0.9375rem; font-weight: 600; letter-spacing: -0.01em; }
    h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 4px; letter-spacing: -0.01em; }
    p { font-size: 0.8125rem; color: #6b6b74; margin: 0 0 24px; }
    label { display: block; font-size: 0.8125rem; font-weight: 500; margin-bottom: 6px; }
    input { width: 100%; font: inherit; font-size: 0.9375rem; padding: 9px 12px; border: 1px solid #e4e4e7;
      border-radius: 6px; margin-bottom: 16px; color: inherit; background: #fff; }
    input:focus { outline: none; border-color: #0066ff; box-shadow: 0 0 0 3px #eff4ff; }
    button { width: 100%; font: inherit; font-size: 0.8125rem; font-weight: 500; color: #fff; background: #0066ff;
      border: none; border-radius: 6px; padding: 10px 14px; cursor: pointer; margin-top: 8px;
      transition: background 120ms ease; }
    button:hover { background: #0052cc; }
    .error { font-size: 0.8125rem; color: #e53935; background: #fdecea; border-radius: 6px; padding: 8px 12px;
      margin-bottom: 16px; }
  </style>
</head>
<body>
  <main class="card">
    <div class="brand">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
      <span class="brand-name">Design Lab</span>
    </div>
    <h1>Sign in</h1>
    <p>Internal to the Ligentix design team.</p>
    ${failed ? '<div class="error" role="alert">Incorrect username or password.</div>' : ''}
    <form method="post" action="/login">
      <input type="hidden" name="next" value="${escapeHtml(returnTo)}">
      <label for="username">Username</label>
      <input id="username" name="username" autocomplete="username" required autofocus>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit">Sign in</button>
    </form>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: failed ? 401 : 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
