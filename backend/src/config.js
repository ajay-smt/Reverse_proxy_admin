import dotenv from 'dotenv';

dotenv.config();

const parseList = (value) =>
  value
    ? value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

export const config = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  allowedHosts: parseList(process.env.ALLOWED_HOSTS),
  corsOrigins: parseList(process.env.CORS_ORIGINS) || [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ],
  proxyPublicUrl: (
    process.env.PROXY_PUBLIC_URL || 
    process.env.RENDER_EXTERNAL_URL || 
    'http://localhost:5000'
  ).replace(/\/$/, ''),
  proxyTimeoutMs: Number(process.env.PROXY_TIMEOUT_MS) || 30000,
  maxRewriteBytes: Number(process.env.MAX_REWRITE_BYTES) || 5 * 1024 * 1024,
  mongodbUri: process.env.MONGODB_URI || '',
  mongodbDbName: process.env.MONGODB_DB_NAME || 'proxyData',
  defaultTargetUrl:
    process.env.DEFAULT_TARGET_URL || 'https://reverse-proxy-p1ne.onrender.com/',
};
