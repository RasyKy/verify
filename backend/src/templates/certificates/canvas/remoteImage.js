/**
 * Fetch + decode a remote image (an organization's logo or signature),
 * memoized by URL — shared by all three canvas templates.
 *
 * See remoteAssetImageCache's doc comment in lib/cache.js for why this
 * exists as a cache keyed on URL rather than each template just re-fetching:
 * the same logo/signature URL is reused across every certificate an
 * organization has ever issued, so without this a render was paying a fresh
 * Supabase Storage round trip per certificate instead of per organization.
 */
import { loadImage } from '@napi-rs/canvas';

import { remoteAssetImageCache } from '../../../lib/cache.js';

/**
 * @param {string} url
 * @returns {Promise<import('@napi-rs/canvas').Image>}
 */
export function loadRemoteImage(url) {
  return remoteAssetImageCache.wrap(url, async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    return loadImage(Buffer.from(await res.arrayBuffer()));
  });
}
