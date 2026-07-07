const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');

const env = require('./config/env');
const logger = require('./utils/logger');
const routes = require('./routes');
const notFound = require('./middlewares/notFound.middleware');
const errorHandler = require('./middlewares/error.middleware');

const app = express();

// Render (and most PaaS hosts) sit behind a reverse proxy — without this,
// express-rate-limit throws on the X-Forwarded-For header it sees, and
// req.ip/req.secure would reflect the proxy instead of the real client.
if (env.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

app.use(
  cors({
    origin: [env.frontendUrl, env.salesFrontendUrl, env.followupsFrontendUrl, env.allFrontendUrl],
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(pinoHttp({ logger }));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
