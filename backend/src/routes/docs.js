/**
 * Swagger/OpenAPI docs — GET /api/docs (NFR-MAINT-02).
 *
 * swagger-jsdoc scans the `@openapi` blocks already living next to every route
 * handler in routes/*.js and assembles them into one spec; swagger-ui-express
 * serves that spec as an interactive page. This file owns the shared pieces
 * every block references (the bearerAuth scheme, the ErrorResponse schema) so
 * individual route files don't repeat them.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import helmet from 'helmet';
import { Router } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const pkg = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')
);

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Verify API',
      version: pkg.version,
      description: pkg.description,
    },
    // Relative, not a hardcoded host: "Try it out" then resolves against
    // whatever origin is actually serving this page, correct in dev, staging
    // and production alike without a dedicated env var.
    servers: [{ url: '/' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Supabase access token. Obtain one via POST /api/auth/login.',
        },
      },
      schemas: {
        // Matches middleware/errorHandler.js's real response shape exactly —
        // referenced by every error response instead of repeating it by hand.
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'BAD_REQUEST' },
                message: { type: 'string' },
                requestId: { type: 'string' },
              },
              required: ['code', 'message'],
            },
            message: {
              type: 'string',
              description: 'Duplicated from error.message for older clients.',
            },
          },
          required: ['error', 'message'],
        },
      },
    },
  },
  // fileURLToPath returns backslash-separated paths on Windows, but the glob
  // matcher swagger-jsdoc uses treats backslash as an escape character rather
  // than a path separator — with a raw Windows path this silently matches zero
  // files. Forward slashes are a no-op on POSIX, so this is safe everywhere.
  apis: [fileURLToPath(new URL('./*.js', import.meta.url)).replace(/\\/g, '/')],
});

export function createDocsRouter() {
  const router = Router();

  // The global helmet() in app.js disables CSP entirely because a restrictive
  // default would break Swagger UI's inline bootstrap script/styles. Rather
  // than leave every route uncovered, apply a real (if permissive-for-this-
  // page) CSP scoped to just /api/docs.
  const docsCsp = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
  });

  router.use('/docs', docsCsp, swaggerUi.serve, swaggerUi.setup(spec));

  return router;
}

export const docsRouter = createDocsRouter();
