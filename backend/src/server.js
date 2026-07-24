/**
 * Process entry point — the only place that binds a port.
 *
 * Run via `npm run dev` / `npm start`, both of which load src/instrument.js
 * first through `node --import` so Sentry is initialised before Express is
 * imported.
 */
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Verify backend listening on :${env.PORT}`, {
    env: env.NODE_ENV,
    chainId: env.CHAIN_ID,
    origins: env.allowedOrigins,
    jwtMode: env.usesLegacyJwtSecret
      ? 'HS256 (legacy secret)'
      : 'JWKS (asymmetric)',
  });
});

/**
 * Railway sends SIGTERM on redeploy. Draining in-flight requests matters here:
 * an issuance that has submitted a transaction but not yet written the receipt
 * would otherwise leave a row stranded as `pending`.
 */
function shutdown(signal) {
  logger.info(`${signal} received — draining connections`);

  const forced = setTimeout(() => {
    logger.error('Graceful shutdown timed out — exiting');
    process.exit(1);
  }, 10_000);
  forced.unref();

  server.close((err) => {
    if (err) {
      logger.error('Error during shutdown', { err });
      process.exit(1);
    }
    logger.info('Shutdown complete');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { err: reason });
});

process.on('uncaughtException', (err) => {
  // State is unknowable after this point — log and let the platform restart us.
  logger.error('Uncaught exception — exiting', { err });
  process.exit(1);
});

export { server };
