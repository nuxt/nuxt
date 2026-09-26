// The value must be a valid CSP nonce (base64 per the spec) so that it can be
// interpolated into `nonce="..."` without escaping.
const SCRIPT_NONCE_RE = /<script(?=[\s>])[^>]*?\snonce="([\w+/\-=]*)"/

export function extractCspNonce (headTags: string): string | undefined {
  return SCRIPT_NONCE_RE.exec(headTags)?.[1] || undefined
}
