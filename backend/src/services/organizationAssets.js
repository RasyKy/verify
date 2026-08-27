/**
 * Organization branding asset storage — logo and signature images used by
 * server-rendered certificate templates (db/migrations/0006_certificate_branding.sql
 * creates the bucket).
 *
 * One object per asset kind per organization, at a stable key
 * (`{organizationId}/{kind}.{ext}`), upserted on replace — same pattern the
 * (now-removed) per-course badge storage used. The bucket is public, so
 * reads never go through this module; only an issuer writing their own
 * org's branding does, gated by the route (routes/organizations.js), not by
 * anything storage-side.
 */
import { adminClient } from '../config/supabase.js';
import { upstreamUnavailable } from '../lib/errors.js';

const BUCKET = 'organization-assets';

/** The only two extensions an asset can have (routes/organizations.js validates this). */
const KNOWN_EXTS = ['png', 'jpg'];

function objectPath(organizationId, kind, ext) {
  return `${organizationId}/${kind}.${ext}`;
}

/**
 * @param {'logo'|'signature'} kind
 * @param {string} organizationId
 * @param {Buffer} buffer
 * @param {string} ext 'png' | 'jpg'
 * @param {string} contentType
 * @returns {Promise<string>} the public URL, cache-busted with a version query
 */
async function uploadAsset(kind, organizationId, buffer, ext, contentType) {
  const path = objectPath(organizationId, kind, ext);

  const { error } = await adminClient.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) {
    throw upstreamUnavailable('Storage', `Could not upload the ${kind} image.`);
  }

  // A replace can switch extension (png -> jpg), which would otherwise leave
  // the old object orphaned under a different key. Best-effort, not awaited
  // for correctness — the new URL already points at `path` regardless.
  const staleExt = KNOWN_EXTS.find((e) => e !== ext);
  void adminClient.storage
    .from(BUCKET)
    .remove([objectPath(organizationId, kind, staleExt)]);

  const {
    data: { publicUrl },
  } = adminClient.storage.from(BUCKET).getPublicUrl(path);

  // The object key is stable across replaces, so without a cache-busting
  // suffix a browser (or CDN) that already fetched the old image would keep
  // showing it after an issuer uploads a new one.
  return `${publicUrl}?v=${Date.now()}`;
}

/**
 * Removes an organization's asset, whichever extension it was stored under —
 * the `organizations` row only keeps the URL, not the extension, so both
 * known extensions are removed (idempotent: deleting a key that was never
 * used is not an error).
 * @param {'logo'|'signature'} kind
 * @param {string} organizationId
 */
async function deleteAsset(kind, organizationId) {
  const paths = KNOWN_EXTS.map((ext) => objectPath(organizationId, kind, ext));
  const { error } = await adminClient.storage.from(BUCKET).remove(paths);
  if (error) {
    throw upstreamUnavailable('Storage', `Could not remove the ${kind} image.`);
  }
}

export const uploadLogo = (organizationId, buffer, ext, contentType) =>
  uploadAsset('logo', organizationId, buffer, ext, contentType);

export const uploadSignature = (organizationId, buffer, ext, contentType) =>
  uploadAsset('signature', organizationId, buffer, ext, contentType);

export const deleteLogo = (organizationId) =>
  deleteAsset('logo', organizationId);

export const deleteSignature = (organizationId) =>
  deleteAsset('signature', organizationId);
