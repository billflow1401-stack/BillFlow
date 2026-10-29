const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const AppError = require('./utils/AppError');
const errorHandler = require('./middleware/errorHandler');
const v1Routes = require('./routes/v1');

const app = express();

// 1. GLOBAL MIDDLEWARES
// Security HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  noSniff: true
}));

// Development logging
if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Limit requests from same API
const limiter = rateLimit({
  max: 1000, // 1000 requests per IP
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Too many requests from this IP, please try again in an hour!'
});
app.use('/api', limiter);

// Body parser, reading data from body into req.body (5mb limit for base64 signature/seal/logo)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// CORS setup
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (env.corsOrigins.includes(origin)) return callback(null, true);
    if (env.nodeEnv === 'development') {
      try {
        const parsed = new URL(origin);
        const host = parsed.hostname;
        if (
          host === 'localhost' ||
          host === '127.0.0.1' ||
          /^192\.168\./.test(host) ||
          /^10\./.test(host) ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
          host.endsWith('.local')
        ) {
          return callback(null, true);
        }
      } catch (e) {}
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  exposedHeaders: ['Content-Disposition']
};
app.use(cors(corsOptions));

// 2. ROUTES
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'BillFlow-Pro API is online',
    healthCheck: '/api/v1/health',
    version: '1.0.0'
  });
});

app.use('/api/v1', v1Routes);

// Handle unknown routes
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// 3. GLOBAL ERROR HANDLER
app.use(errorHandler);

module.exports = app;
