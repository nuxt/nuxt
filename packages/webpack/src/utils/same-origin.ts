import { isIP } from 'node:net'

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])

interface DevRequest {
  headers: Record<string, string | string[] | undefined>
}

function firstHeader (value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function parseHostname (host: string): string | undefined {
  const value = host.trim().toLowerCase()
  if (value.startsWith('[')) {
    const end = value.indexOf(']')
    return end > 1 ? value.slice(1, end) : undefined
  }
  return value.split(':')[0] || undefined
}

function isLoopbackHost (host: string | undefined): boolean {
  const hostname = host && parseHostname(host)
  return !!hostname && LOOPBACK_HOSTNAMES.has(hostname)
}

type AllowedHosts = string[] | true

/**
 * The hosts allowed by `devServer.allowedHosts` and `vite.server.allowedHosts`, read on each call
 * so that hosts added once the dev server is listening are included.
 */
export function resolveAllowedHosts (options: { devServer: { allowedHosts?: AllowedHosts }, vite?: { server?: { allowedHosts?: AllowedHosts } } }): AllowedHosts {
  const sources = [options.devServer.allowedHosts, options.vite?.server?.allowedHosts]
  if (sources.includes(true)) { return true }
  return [...new Set(sources.flatMap(hosts => Array.isArray(hosts) ? hosts : []))]
}

export function isAllowedHost (host: string | undefined, allowedHosts: readonly string[] | true = []): boolean {
  if (!host || allowedHosts === true) { return true }
  const hostname = parseHostname(host)
  if (!hostname) { return false }
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || isIP(hostname)) { return true }
  for (const entry of allowedHosts) {
    const allowed = entry.toLowerCase()
    if (allowed === hostname) { return true }
    if (allowed.startsWith('.') && (hostname === allowed.slice(1) || hostname.endsWith(allowed))) { return true }
  }
  return false
}

export function isSameOriginRequest (req: DevRequest, allowedHosts?: readonly string[] | true): boolean {
  const host = firstHeader(req.headers.host)
  if (!isAllowedHost(host, allowedHosts)) {
    return false
  }

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
    return isLoopbackHost(host)
  }

  try {
    return new URL(initiator).host === host
  } catch {
    return false
  }
}
