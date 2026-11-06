// Vercel Routing Middleware — runs before every request (app shell, JSON, and
// prototype files) and gates the whole site behind HTTP Basic Auth.
// Credentials come from the BASIC_AUTH_USER / BASIC_AUTH_PASSWORD env vars set
// in the Vercel dashboard. Not run by `ng serve`, so local dev stays open.
import { next } from '@vercel/functions';

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
    }
  }
}

export default function middleware(request: Request): Response {
  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;

  // Fail closed: if the env vars are missing, don't silently expose the site.
  if (!user || !password) {
    return new Response('Site protection is not configured.', { status: 503 });
  }

  const header = request.headers.get('authorization') ?? '';
  const [scheme, encoded] = header.split(' ');

  if (scheme === 'Basic' && encoded) {
    let decoded = '';
    try {
      decoded = atob(encoded);
    } catch {
      // Malformed base64 — fall through to the 401 below.
    }
    const separator = decoded.indexOf(':');
    const givenUser = decoded.slice(0, separator);
    const givenPassword = decoded.slice(separator + 1);

    if (separator !== -1 && safeEqual(givenUser, user) && safeEqual(givenPassword, password)) {
      return next();
    }
  }

  return new Response('Authentication required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Design Lab", charset="UTF-8"' },
  });
}

// Constant-time comparison so response timing doesn't leak the password.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
