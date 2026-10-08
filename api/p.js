export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': '*'
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const target = new URL(req.url).searchParams.get('url');
  if (!target) return new Response('url yok', { status: 400, headers: CORS });

  const r = await fetch(target, {
    headers: { 'User-Agent': 'Televizo/1.9.0' },
    redirect: 'follow'
  });
  const h = new Headers(r.headers);
  for (const [k, v] of Object.entries(CORS)) h.set(k, v);
  return new Response(r.body, { status: r.status, headers: h });
}
