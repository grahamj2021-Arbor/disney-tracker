// Disney World CORS Proxy — Cloudflare Worker
// Deploy: dash.cloudflare.com → Workers & Pages → Create → Worker → paste → Deploy
export default {
  async fetch(req) {
    const park = new URL(req.url).searchParams.get('park') || '6';
    if(!['5','6','7','8'].includes(park)) return new Response('Invalid park ID',{status:400});
    const upstream = await fetch(`https://queue-times.com/parks/${park}/queue_times.json`,{
      headers:{'User-Agent':'DisneyTracker/1.0','Accept':'application/json'}
    });
    const body = await upstream.text();
    return new Response(body,{headers:{
      'Content-Type':'application/json',
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Methods':'GET',
      'Cache-Control':'public, max-age=60'
    }});
  }
};
