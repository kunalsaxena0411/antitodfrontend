
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get('url');

  // Define CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-KEY, Authorization, Accept',
    'X-Source-Proxy': 'Vercel'
  };

  if (!targetUrl) {
    return new Response('Missing url parameter', { status: 400, headers: corsHeaders });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const forwardHeaders = new Headers(req.headers);
    // Filter out restricted headers
    forwardHeaders.delete('host');
    forwardHeaders.delete('connection');
    forwardHeaders.delete('content-length');
    // Ensure User-Agent is set
    forwardHeaders.set('User-Agent', 'Mozilla/5.0 (Xyberah Threat Processor)');

    const fetchOptions = {
      method: req.method,
      headers: forwardHeaders
    };

    // Explicitly attach body only for non-GET/HEAD requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        fetchOptions.body = req.body;
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Reconstruct headers for the response
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, X-API-KEY, Authorization, Accept');
    responseHeaders.set('X-Source-Proxy', 'Vercel');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    // Explicitly define error headers to avoid spread syntax issues
    const errorHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-KEY, Authorization, Accept'
    };

    return new Response(JSON.stringify({ error: 'Proxy fetch failed', details: error.message }), {
      status: 500,
      headers: errorHeaders,
    });
  }
}
