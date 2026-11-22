'use strict';
const env = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');
const logger = require('./utils/logger');

const startServer = async () => {
  await connectDB();
  const server = app.listen(env.PORT, () => {
    logger.info(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    logger.info(`Health check: http://localhost:${env.PORT}/api/v1/health`);
  });
  const gracefulShutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => { logger.info('HTTP server closed.'); process.exit(0); });
    setTimeout(() => { logger.error('Forced shutdown.'); process.exit(1); }, 10000);
  };
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => { logger.error('Unhandled Rejection:', reason); gracefulShutdown('unhandledRejection'); });
  process.on('uncaughtException', (err) => { logger.error('Uncaught Exception:', err); gracefulShutdown('uncaughtException'); });
};

startServer();
