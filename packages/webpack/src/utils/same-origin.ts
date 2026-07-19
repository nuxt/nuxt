const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])

function firstHeader (value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function isLoopbackHost (host: string | undefined): boolean {
  if (!host) { return false }
  const withoutPort = host.replace(/:\d+$/, '')
  const hostname = withoutPort.replace(/^\[|\]$/g, '').toLowerCase()
  return LOOPBACK_HOSTNAMES.has(hostname)
}

export function isSameOriginRequest (req: { headers: Record<string, string | string[] | undefined> }): boolean {
  const site = firstHeader(req.headers['sec-fetch-site'])
  if (site !== undefined) {
    return site === 'same-origin' || site === 'none'
  }

  const initiator = firstHeader(req.headers.origin) || firstHeader(req.headers.referer)
  if (!initiator) {
    // A request with no `Sec-Fetch-Site`, `Origin`, or `Referer` is only safe to
    // allow when the dev server is loopback-bound: a browser-originated request
    // can reach a non-loopback bind (e.g. `nuxt dev --host`) with all three
    // headers absent if the attacker page is on a non-trustworthy origin
    // (drops `Sec-Fetch-*`), uses a non-CORS `<script>` (no `Origin`), and sets
    // `Referrer-Policy: no-referrer` (drops `Referer`).
    return isLoopbackHost(firstHeader(req.headers.host))
  }

  try {
    return new URL(initiator).host === firstHeader(req.headers.host)
  } catch {
    return false
  }
}
