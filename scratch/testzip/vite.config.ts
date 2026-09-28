import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    corsProxyPlugin(),
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
          charts: ['recharts', 'd3']
        }
      }
    }
  }
})


