import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import https from 'https'
import http from 'http'

// Custom Vite plugin to mimic the Vercel /api/proxy endpoint locally
function corsProxyPlugin() {
  return {
    name: 'cors-proxy',
    configureServer(server: any) {
      server.middlewares.use('/api/proxy', (req: any, res: any) => {
        const urlStr = req.url;
        const targetUrl = new URL(urlStr, 'http://localhost').searchParams.get('url');
        
        if (!targetUrl) {
          res.statusCode = 400;
          return res.end('Missing url parameter');
        }

        const options = {
          method: req.method,
          headers: {
            ...(() => { const h = { ...req.headers }; delete h.origin; delete h.referer; return h; })(),
            host: new URL(targetUrl).host
          }
        };

        const client = targetUrl.startsWith('https') ? https : http;
        const proxyReq = client.request(targetUrl, options, (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 200, {
            ...proxyRes.headers,
            'Access-Control-Allow-Origin': '*',
            'X-Source-Proxy': 'vite',
            'Content-Type': proxyRes.headers['content-type'] || 'text/plain',
          });
          proxyRes.pipe(res);
        });

        proxyReq.on('error', (err: any) => {
          res.statusCode = 500;
          res.end(err.message);
        });

        req.pipe(proxyReq);
      });
    }
  };
}

// Task 106: Resolve backend origin from VITE_BACKEND_URL for CSP connect-src
export function getBackendOrigin(rawUrl?: string): string {
  if (!rawUrl || !rawUrl.trim()) return '';
  try {
    const parsed = new URL(rawUrl.trim());
    const hostname = parsed.hostname.toLowerCase();
    // Keep https://*.xyberah.com so production keeps working.
    // If backend URL already matches *.xyberah.com or xyberah.com, do not add an extra origin.
    if (hostname === 'xyberah.com' || hostname.endsWith('.xyberah.com')) {
      return '';
    }
    return parsed.origin;
  } catch {
    return '';
  }
}

// Task 102 & Task 106: Content Security Policy plugin (strict 'self' script-src with no inline scripts in production)
function cspPlugin(backendUrl?: string) {
  const backendOrigin = getBackendOrigin(backendUrl);

  return {
    name: 'html-csp-policy',
    transformIndexHtml(html: string, ctx: any) {
      const isBuild = !ctx?.server;
      const scriptSrc = isBuild ? "'self' https://checkout.razorpay.com" : "'self' 'unsafe-inline' https://checkout.razorpay.com";

      const connectOrigins = [
        "'self'",
        'https://*.xyberah.com',
        backendOrigin,
        'https://api.razorpay.com',
        'https://lumberjack.razorpay.com',
        'https://lumberjack-cx.razorpay.com',
        'https://dns.google',
        'https://cloudflare-dns.com',
        'https://otx.alienvault.com',
        'https://www.virustotal.com',
        'https://feodotracker.abuse.ch',
        'https://threatfox-api.abuse.ch',
        'https://urlhaus-api.abuse.ch',
        'https://bazaar.abuse.ch',
        'https://raw.githubusercontent.com',
        'https://services.nvd.nist.gov',
        'https://www.cisa.gov',
        'https://cvefeed.io',
        'https://www.zerodayinitiative.com',
        'https://gitlab.com',
        'https://cdn.jsdelivr.net',
        'https://malpedia.caad.fkie.fraunhofer.de',
        'https://api.ipapi.is',
        'https://www.peeringdb.com',
        'https://stat.ripe.net',
        'https://dns.quad9.net',
        'https://security.cloudflare-dns.com',
        'https://internetdb.shodan.io',
      ].filter(Boolean);

      const connectSrc = isBuild
        ? connectOrigins.join(' ')
        : "'self' https: http://localhost:* ws://localhost:* ws:";

      const csp = `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src ${connectSrc}; frame-src 'self' blob: data: https://api.razorpay.com; object-src 'none'; base-uri 'self'; form-action 'self';`;

      if (html.includes('http-equiv="Content-Security-Policy"')) {
        return html.replace(
          /<meta\s+http-equiv="Content-Security-Policy"[^>]*>/i,
          `<meta http-equiv="Content-Security-Policy" content="${csp}" />`
        );
      }
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`
      );
    }
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = process.env.VITE_BACKEND_URL || env.VITE_BACKEND_URL || '';

  return {
    plugins: [
      react(),
      corsProxyPlugin(),
      cspPlugin(backendUrl),
      nodePolyfills({
        include: ['buffer'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    build: {
      sourcemap: false, // Disabling sourcemaps significantly reduces memory usage during build
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            tfjs: ['@tensorflow/tfjs', '@tensorflow-models/mobilenet'],
            lucide: ['lucide-react'],
            charts: ['recharts', 'd3'],
            globe: ['react-globe.gl', 'three']
          }
        }
      }
    }
  };
});


