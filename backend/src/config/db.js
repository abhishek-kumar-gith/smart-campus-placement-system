const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

let retryCount = 0;
const MAX_RETRIES = 5;

const connectDB = async () => {
  if (!env.MONGODB_URI) {
    logger.warn('MONGODB_URI not set. Skipping DB connection (development mode without DB).');
    return;
  }
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    retryCount = 0;
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    retryCount++;
    logger.error(`MongoDB connection failed (attempt ${retryCount}): ${error.message}`);
    if (retryCount < MAX_RETRIES) {
      logger.info(`Retrying in 5 seconds...`);
      setTimeout(connectDB, 5000);
    } else {
      logger.error('Max MongoDB connection retries reached. Exiting.');
      process.exit(1);
    }
  }
};

mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected.'));
mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected.'));

module.exports = connectDB;
