const app = require('./app');
const env = require('./config/env');
const connectDb = require('./config/db');
const logger = require('./utils/logger');

async function main() {
  await connectDb();
  app.listen(env.port, () => {
    logger.info(`EMS backend listening on port ${env.port}`);
  });
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
