require('dotenv').config();

const requiredEnvs = ['MONGO_URI', 'JWT_SECRET'];
const missingEnvs = requiredEnvs.filter(env => !process.env[env]);

if (missingEnvs.length > 0) {
  console.error(`[FATAL ERROR] Missing required environment variables: ${missingEnvs.join(', ')}`);
  process.exit(1);
}

const nodeEnv = process.env.NODE_ENV;
if (!nodeEnv || !['development', 'production', 'test'].includes(nodeEnv)) {
  console.error(`[FATAL ERROR] NODE_ENV is missing or invalid. Must be 'development', 'production', or 'test'.`);
  process.exit(1);
}

if (nodeEnv === 'production') {
  if (process.env.JWT_SECRET.length < 32) {
    console.error(`[FATAL ERROR] JWT_SECRET must be at least 32 characters long in production.`);
    process.exit(1);
  }
}

// CORS parsing - allow local development and deployed Render frontend by default
let corsOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://frontend-232i.onrender.com'
];
if (process.env.CORS_ORIGIN) {
  const origins = process.env.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean);
  if (nodeEnv === 'production' && origins.includes('*')) {
    console.error(`[FATAL ERROR] CORS_ORIGIN must not contain wildcard '*' in production.`);
    process.exit(1);
  }
  origins.forEach(origin => {
    try {
      const url = new URL(origin);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        console.error(`[FATAL ERROR] CORS_ORIGIN scheme must be http or https. Invalid origin: ${origin}`);
        process.exit(1);
      }
    } catch (e) {
      console.error(`[FATAL ERROR] CORS_ORIGIN contains invalid URL: ${origin}`);
      process.exit(1);
    }
  });
  corsOrigins = Array.from(new Set([...corsOrigins, ...origins]));
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  nodeEnv: nodeEnv,
  corsOrigins,
  customDnsServers: process.env.CUSTOM_DNS_SERVERS ? process.env.CUSTOM_DNS_SERVERS.split(',') : null,
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata'
};
