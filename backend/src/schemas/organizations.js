/**
 * Issuer self-service organization settings — certificate branding only
 * (logo/signature uploads are multipart, validated separately in the route).
 *
 * Template choice is NOT here — it's per-course (schemas/certificate.js's
 * updateCourseTemplateSchema), not institution-wide.
 */
import { z } from 'zod';

import { hashableText } from './common.js';

export const updateOrganizationSchema = z
  .object({
    signatoryName: hashableText('Signatory name', { min: 1, max: 200 }),
    signatoryTitle: hashableText('Signatory title', { min: 1, max: 200 }),
  })
  .partial()
  .strict();
