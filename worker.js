// Disney World CORS Proxy — Cloudflare Worker
// Proxies: queue-times.com (wait times) + api.themeparks.wiki (dual verification)
// Deploy: dash.cloudflare.com → Workers & Pages → Create → Worker → paste → Deploy
export default {
  async fetch(req) {
    // CORS preflight
    if(req.method === 'OPTIONS') {
      return new Response(null, {headers:{
        'Access-Control-Allow-Origin':'*',
        'Access-Control-Allow-Methods':'GET,OPTIONS',
        'Access-Control-Max-Age':'86400',
      }});
    }

    const url = new URL(req.url);
    const park = url.searchParams.get('park');
    const tpw  = url.searchParams.get('tpw');

    let upstreamUrl;

    if(tpw) {
      // ThemeParks.wiki — validate UUID format before proxying
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tpw)) {
        return new Response('Invalid entity ID', {status:400});
      }
      const sub = url.searchParams.get('sub') || 'live';
      if(!['live','children'].includes(sub)) return new Response('Invalid sub', {status:400});
      upstreamUrl = `https://api.themeparks.wiki/v1/entity/${tpw}/${sub}`;
    } else if(park) {
      if(!['5','6','7','8'].includes(park)) return new Response('Invalid park ID', {status:400});
      upstreamUrl = `https://queue-times.com/parks/${park}/queue_times.json`;
    } else {
      return new Response('Missing park or tpw parameter', {status:400});
    }

    try {
      const upstream = await fetch(upstreamUrl, {
        headers:{'User-Agent':'DisneyTracker/1.0','Accept':'application/json'}
      });
      const body = await upstream.text();
      return new Response(body, {headers:{
        'Content-Type':'application/json',
        'Access-Control-Allow-Origin':'*',
        'Access-Control-Allow-Methods':'GET',
        'Cache-Control':'public, max-age=60'
      }});
    } catch(e) {
      return new Response(JSON.stringify({error:e.message}), {
        status:502,
        headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}
      });
    }
  }
};
