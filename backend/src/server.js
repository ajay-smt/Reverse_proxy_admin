import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { connectMongo } from './db/mongodb.js';
import { corsMiddleware } from './middleware/cors.js';
import captureRouter from './routes/capture.js';
import proxyRouter from './routes/proxy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.disable('x-powered-by');
app.use(compression());
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(corsMiddleware);
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'reverse-proxy',
    proxyEndpoint: `${config.proxyPublicUrl}/proxy?url=`,
    proxyDataCapture: `${config.proxyPublicUrl}/internal/proxy-data/users`,
  });
});

app.use('/internal', express.json({ limit: '1mb' }), captureRouter);

// Serve static assets or fallback to index.html for SPA routes (only in production / if dist exists)
const distPath = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(distPath)) {
  console.log(`[server] Serving static frontend files from: ${distPath}`);
  
  // Debug logging for root path
  app.use((req, res, next) => {
    if (req.path === '/') {
      console.log('[server] Request headers for /:', {
        'sec-fetch-dest': req.headers['sec-fetch-dest'],
        'sec-fetch-mode': req.headers['sec-fetch-mode'],
        referer: req.headers['referer'],
        cookie: req.headers['cookie']
      });
    }
    next();
  });

  // Serve static files for parent window requests (not iframes)
  app.use((req, res, next) => {
    const dest = req.headers['sec-fetch-dest'];
    if (dest === 'iframe') {
      return next();
    }
    express.static(distPath)(req, res, next);
  });
} else {
  console.warn('[server] frontend/dist directory not found. Static file serving skipped.');
}

app.use(proxyRouter);

app.use((_req, res) => {
  res.status(404).json({
    error: 'Not found',
    routes: {
      health: '/health',
      proxy: '/proxy?url=https://example.com',
    },
  });
});

app.use((err, _req, res, _next) => {
  console.error('[server] unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
  });
});

async function start() {
  await connectMongo();

  app.listen(config.port, () => {
    console.log(`Reverse proxy listening on http://localhost:${config.port}`);
    console.log(`Proxy URL: ${config.proxyPublicUrl}/proxy?url=https://example.com`);
    console.log(`ProxyData capture: POST ${config.proxyPublicUrl}/internal/proxy-data/users`);
    if (config.allowedHosts.length) {
      console.log(`Allowed hosts: ${config.allowedHosts.join(', ')}`);
    } else {
      console.warn('ALLOWED_HOSTS is empty — all hosts are permitted (set in production)');
    }
  });
}

start();

export default app;
