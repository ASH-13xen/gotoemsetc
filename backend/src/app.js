const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');

const env = require('./config/env');
const logger = require('./utils/logger');
const routes = require('./routes');
const admsRoutes = require('./routes/adms.routes');
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

// The ZKTeco biometric device speaks its own ADMS protocol at these fixed
// paths (not under /api, and not JSON) — mounted first, with a raw-text
// parser scoped only to this router, so it never touches the JSON parser
// below or the JWT-gated /api routes.
app.use('/iclock', express.text({ type: () => true, limit: '2mb' }), admsRoutes);

// The Google Form webhook sends resumes as base64 inside the JSON body,
// comfortably past the 5mb default — needs its own parser instance with a
// higher limit, applied only to that path (a second express.json() call
// further down the chain would find the stream already consumed and reset
// req.body to {}, so this has to be the *only* parser that path hits).
const GOOGLE_FORM_WEBHOOK_PATH = '/api/public/applicants/google-form';
app.use((req, res, next) => {
  const limit = req.path === GOOGLE_FORM_WEBHOOK_PATH ? '20mb' : '5mb';
  express.json({ limit })(req, res, next);
});

app.use(pinoHttp({ logger }));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
