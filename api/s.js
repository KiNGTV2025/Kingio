export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': '*'
};
const DEFAULT_UA = 'VLC/3.0.18 LibVLC/3.0.18';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const self = new URL(req.url);
  const target = self.searchParams.get('url');
  const ua = self.searchParams.get('ua') || DEFAULT_UA;
  const ref = self.searchParams.get('ref') || '';
  if (!target) return new Response('url yok', { status: 400, headers: CORS });

  const headers = { 'User-Agent': ua };
  if (ref) {
    headers['Referer'] = ref;
    try { headers['Origin'] = new URL(ref).origin; } catch (e) {}
  }
  const range = req.headers.get('range');
  if (range) headers['Range'] = range;

  let r;
  try {
    r = await fetch(target, { headers, redirect: 'follow' });
  } catch (e) {
    return new Response('upstream hata: ' + e.message, { status: 502, headers: CORS });
  }

  const ct = (r.headers.get('content-type') || '').toLowerCase();
  const maybePlaylist = ct.includes('mpegurl') || ct.startsWith('text/') ||
    /\.m3u8?($|\?)/i.test(target);

  if (maybePlaylist && r.ok) {
    const text = await r.text();
    if (text.trimStart().startsWith('#EXTM3U')) {
      const base = r.url || target;
      const wrap = (u) => {
        let abs;
        try { abs = new URL(u, base).href; } catch (e) { return u; }
        let p = `${self.origin}/api/s?url=${encodeURIComponent(abs)}`;
        if (self.searchParams.get('ua')) p += `&ua=${encodeURIComponent(ua)}`;
        if (ref) p += `&ref=${encodeURIComponent(ref)}`;
        return p;
      };
      const out = text.split(/\r?\n/).map((line) => {
        const l = line.trim();
        if (!l) return line;
        if (l.startsWith('#')) {
          return line.replace(/URI="([^"]+)"/g, (m, u) => `URI="${wrap(u)}"`);
        }
        return wrap(l);
      }).join('\n');
      return new Response(out, {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store' }
      });
    }
    return new Response(text, { status: r.status, headers: { ...CORS, 'Content-Type': ct || 'text/plain' } });
  }

  const h = new Headers(CORS);
  for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const v = r.headers.get(k);
    if (v) h.set(k, v);
  }
  return new Response(r.body, { status: r.status, headers: h });
}
