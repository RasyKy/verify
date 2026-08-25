/**
 * Course badge storage — the backend's only point of contact with Supabase
 * Storage (db/migrations/0004_course_badges.sql creates the bucket).
 *
 * One object per course, at a stable key (`{organizationId}/{courseId}.{ext}`),
 * upserted on replace — "editing" a badge is just re-uploading to the same
 * key, which is why there's no separate rename/move logic here. The bucket
 * is public, so reads never go through this module; only issuers writing
 * their own org's badge do, gated by the route (routes/courses.js), not by
 * anything storage-side.
 */
import { adminClient } from '../config/supabase.js';
import { upstreamUnavailable } from '../lib/errors.js';

const BUCKET = 'course-badges';

/** The only two extensions a badge can have (routes/courses.js validates this). */
const KNOWN_EXTS = ['png', 'jpg'];

function objectPath(organizationId, courseId, ext) {
  return `${organizationId}/${courseId}.${ext}`;
}

/**
 * @param {string} organizationId
 * @param {string} courseId
 * @param {Buffer} buffer
 * @param {string} ext 'png' | 'jpg'
 * @param {string} contentType
 * @returns {Promise<string>} the public URL, cache-busted with a version query
 */
export async function uploadBadge(
  organizationId,
  courseId,
  buffer,
  ext,
  contentType
) {
  const path = objectPath(organizationId, courseId, ext);

  const { error } = await adminClient.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) {
    throw upstreamUnavailable('Storage', 'Could not upload the badge image.');
  }

  // A replace can switch extension (png -> jpg), which would otherwise leave
  // the old object orphaned under a different key. Best-effort, not awaited
  // for correctness — the new badge_url already points at `path` regardless.
  const staleExt = KNOWN_EXTS.find((e) => e !== ext);
  void adminClient.storage
    .from(BUCKET)
    .remove([objectPath(organizationId, courseId, staleExt)]);

  const {
    data: { publicUrl },
  } = adminClient.storage.from(BUCKET).getPublicUrl(path);

  // The object key is stable across replaces, so without a cache-busting
  // suffix a browser (or CDN) that already fetched the old badge would keep
  // showing it after an issuer uploads a new one.
  return `${publicUrl}?v=${Date.now()}`;
}

/**
 * Removes a course's badge, whichever extension it was stored under — the
 * `courses` row only keeps `badge_url`, not the extension, so both known
 * extensions are removed (idempotent: deleting a key that was never used is
 * not an error).
 * @param {string} organizationId
 * @param {string} courseId
 */
export async function deleteBadge(organizationId, courseId) {
  const paths = KNOWN_EXTS.map((ext) =>
    objectPath(organizationId, courseId, ext)
  );
  const { error } = await adminClient.storage.from(BUCKET).remove(paths);
  if (error) {
    throw upstreamUnavailable('Storage', 'Could not remove the badge image.');
  }
}
