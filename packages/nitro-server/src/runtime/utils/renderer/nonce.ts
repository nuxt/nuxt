/**
 * Extract the CSP nonce stamped onto the rendered head scripts.
 *
 * The streaming renderer emits several inline `<script>`s that bypass unhead
 * (bootstrap queue, IIFE, mid-stream head-push chunks, island relocation), so a
 * strict `script-src 'nonce-…'` policy would block them. This reuses whatever
 * nonce a security module stamped onto the head scripts; if none is present the
 * caller omits the attribute and behaviour is unchanged.
 *
 * The match is anchored to the exact `nonce` attribute name (leading/trailing
 * tag delimiter or whitespace) so an unrelated `*-nonce` attribute (e.g. a
 * `data-nonce`) is never mistaken for the CSP nonce.
 *
 * @internal
 */
export function getNonceFromHeadTags (headTags: string): string | undefined {
  return headTags.match(/<script[^>]*\snonce="([^"]*)"/)?.[1]
}
