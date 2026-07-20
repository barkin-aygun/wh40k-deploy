/**
 * Encodes a pasted army list into a compact, URL-safe payload (gzip via the
 * browser's native CompressionStream — no dependency — then base64url), so a
 * roster can be shared as a link that reconstructs the same paste-and-show
 * flow on open. Decoding is the exact inverse.
 */

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url) {
  const pad = b64url.length % 4 === 0 ? '' : '='.repeat(4 - (b64url.length % 4));
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const binary = atob(b64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function gzip(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

/** Compress + encode a list's raw text for use as a URL query param value. */
export async function encodeListForUrl(text) {
  return bytesToBase64Url(await gzip(text));
}

/** Inverse of encodeListForUrl. Throws if the payload is malformed. */
export async function decodeListFromUrl(encoded) {
  return gunzip(base64UrlToBytes(encoded));
}

/** Build a full shareable URL for the roster page carrying this list. */
export async function buildRosterShareUrl(text) {
  const encoded = await encodeListForUrl(text);
  const base = window.location.origin + window.location.pathname;
  return `${base}?list=${encoded}#/roster`;
}

/** Read + decode the ?list= param from the current URL, if present.
 *  Returns null if absent or malformed (caller decides how to surface that). */
export async function readSharedListFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('list');
  if (!encoded) return null;
  try {
    return await decodeListFromUrl(encoded);
  } catch (e) {
    console.error('Failed to decode shared list from URL', e);
    return null;
  }
}
