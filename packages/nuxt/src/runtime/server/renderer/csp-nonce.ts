// The value must be a valid CSP nonce (base64 per the spec) so that it can be
// interpolated into `nonce="..."` without escaping.
const SCRIPT_NONCE_RE = /<script(?=[\s>])[^>]*?\snonce="([\w+/\-=]*)"/
const TAG_RE = /<(\/?)(script|style)\b([^>]*)>/gi
const NONCE_RE = /\snonce\s*=/i

export function extractCspNonce (headTags: string): string | undefined {
  return SCRIPT_NONCE_RE.exec(headTags)?.[1] || undefined
}

export function addNonceToTags (html: string, nonce: string): string {
  let rawTextTag: string | null = null
  return html.replace(TAG_RE, (full, closing, tag, attrs) => {
    if (rawTextTag) {
      if (closing && tag === rawTextTag) { rawTextTag = null }
      return full
    }
    if (closing) { return full }
    rawTextTag = tag
    return NONCE_RE.test(attrs) ? full : `<${tag}${attrs} nonce="${nonce}">`
  })
}
