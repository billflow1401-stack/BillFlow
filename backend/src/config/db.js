const mongoose = require('mongoose');
const env = require('./env');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.mongoUri);
    console.log(`[MongoDB] Connected safely to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB Error] Failed to connect to database: ${error.message}`);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Connection lost.');
});

mongoose.connection.on('error', (err) => {
  console.error(`[MongoDB Error] ${err.message}`);
});

module.exports = connectDB;
