// The value must be a valid CSP nonce (base64 per the spec) so that it can be
// interpolated into `nonce="..."` without escaping.
const SCRIPT_NONCE_RE = /<script(?=[\s>])[^>]*?\snonce="([\w+/\-=]*)"/
const TAG_WITHOUT_NONCE_RE = /<(script|style)\b(?![^>]*\snonce\s*=)([^>]*)>/gi

export function extractCspNonce (headTags: string): string | undefined {
  return SCRIPT_NONCE_RE.exec(headTags)?.[1] || undefined
}

export function addNonceToTags (html: string, nonce: string): string {
  return html.replace(
    TAG_WITHOUT_NONCE_RE,
    (_, tag, attrs) => `<${tag}${attrs} nonce="${nonce}">`,
  )
}
