import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import morgan from 'morgan';
import { config } from './config.js';
import { connectMongo } from './db/mongodb.js';
import { corsMiddleware } from './middleware/cors.js';
import captureRouter from './routes/capture.js';
import proxyRouter from './routes/proxy.js';

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
