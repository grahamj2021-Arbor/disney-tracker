// Disney World CORS Proxy — Cloudflare Worker
// Locks CORS to disney-tracker-chi.vercel.app and its preview deployments.
// Deploy: dash.cloudflare.com → Workers & Pages → Create → Worker → paste → Deploy

const ALLOWED_ORIGINS = new Set([
  'https://disney-tracker-chi.vercel.app',
]);

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Allow Vercel preview deployments (disney-tracker-*.vercel.app)
  try {
    const u = new URL(origin);
    return u.hostname.endsWith('.vercel.app') && u.hostname.startsWith('disney-tracker');
  } catch { return false; }
}

export default {
  async fetch(req) {
    const origin = req.headers.get('Origin') || '';
    const allowed = isAllowedOrigin(origin);
    // Reflect the allowed origin; fall back to the canonical domain for non-browser callers.
    const corsOrigin = allowed ? origin : 'https://disney-tracker-chi.vercel.app';

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Max-Age': '86400',
          'Vary': 'Origin',
        },
      });
    }

    if (req.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    const park = new URL(req.url).searchParams.get('park') || '6';
    if (!['5', '6', '7', '8'].includes(park)) {
      return new Response('Invalid park ID', { status: 400 });
    }

    // Reject browser requests from disallowed origins (prevents quota abuse from other sites)
    if (origin && !allowed) {
      return new Response('Forbidden', { status: 403 });
    }

    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      const upstream = await fetch(
        `https://queue-times.com/parks/${park}/queue_times.json`,
        {
          headers: { 'User-Agent': 'DisneyTracker/1.0', 'Accept': 'application/json' },
          signal: controller.signal,
        }
      );
      clearTimeout(t);

      if (!upstream.ok) {
        return new Response('Upstream error', { status: upstream.status });
      }

      const body = await upstream.text();
      return new Response(body, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Methods': 'GET',
          'Cache-Control': 'public, max-age=60',
          'Vary': 'Origin',
        },
      });
    } catch (e) {
      const status = e.name === 'AbortError' ? 504 : 502;
      return new Response('Proxy error', { status });
    }
  },
};
