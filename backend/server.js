const env = require('./src/config/env');
const connectDB = require('./src/config/db');
const app = require('./src/app');
const mongoose = require('mongoose');

// Apply optional DNS override for specific local environments
if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
  console.log(`[Config] Applied custom DNS servers: ${env.customDnsServers.join(', ')}`);
}

// Handle uncaught exceptions gracefully
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION] Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

let server;

// Start server and connect to DB
const startServer = async () => {
  await connectDB();
  
  server = app.listen(env.port, () => {
    console.log(`[Server] Running on port ${env.port} in ${env.nodeEnv} mode`);
    
    // Auto-shutdown for testing if requested
    if (process.env.TEST_STARTUP) {
      setTimeout(() => {
        console.log('[Test] Gracefully shutting down...');
        server.close(() => process.exit(0));
      }, 1000);
    }
  });
};

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION] Shutting down...');
  console.error(err.name, err.message);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// Graceful shutdown on SIGTERM (e.g., Heroku, Render, Docker)
let isShuttingDown = false;
process.on('SIGTERM', () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  
  if (server) {
    server.close(async () => {
      console.log('💥 HTTP server closed');
      try {
        await mongoose.connection.close();
        console.log('💥 MongoDB connection closed');
      } catch (err) {
        console.error('💥 Error closing MongoDB connection:', err);
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
