import type { H3Event } from 'nitro/h3'

export const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/**
 * Whether the connected peer is a loopback address.
 *
 * This inspects the TCP peer address rather than request metadata, so a
 * non-browser client cannot make itself look local by choosing its `Host`,
 * `Origin`, `Referer` or `Sec-Fetch-*` headers. `x-forwarded-for` is ignored on
 * purpose: only the address of the socket we are actually talking to counts.
 */
export function isLoopbackPeer (event: H3Event): boolean {
  return isLoopbackAddress(event.req.ip)
}

export function isLoopbackAddress (address: string | undefined | null): boolean {
  if (!address) {
    return false
  }
  let normalized = address.trim().toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
  // drop an IPv6 zone id, e.g. `fe80::1%eth0`
  const zoneIndex = normalized.indexOf('%')
  if (zoneIndex !== -1) {
    normalized = normalized.slice(0, zoneIndex)
  }
  // unwrap IPv4-mapped IPv6 addresses, e.g. `::ffff:127.0.0.1`
  if (normalized.startsWith('::ffff:')) {
    normalized = normalized.slice('::ffff:'.length)
  }
  if (normalized === '::1') {
    return true
  }
  // IPv4 loopback range 127.0.0.0/8
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)
}

/**
 * Header-based same-origin/allowed-host gate shared by dev-only handlers.
 *
 * A request with no `Sec-Fetch-Site`, `Origin` or `Referer` cannot be a
 * cross-site browser request, so it is treated as local; this is the deliberate
 * CSRF behaviour relied on by other dev handlers. Endpoints that disclose
 * sensitive local state to non-browser clients must additionally require
 * {@link isLoopbackPeer}, since these headers are all attacker-controlled over a
 * direct connection.
 */
export function isLocalDevRequest (event: H3Event, allowedHosts: ReadonlySet<string> | true): boolean {
  const hostHeader = event.req.headers.get('host')
  if (allowedHosts !== true) {
    const host = hostHeader?.split(':')[0]
    if (!host || !allowedHosts.has(host)) {
      return false
    }
  }

  const site = event.req.headers.get('sec-fetch-site')
  if (site !== null) {
    return site === 'same-origin' || site === 'none'
  }

  const initiator = event.req.headers.get('origin') || event.req.headers.get('referer')
  if (!initiator) {
    return true
  }

  try {
    return new URL(initiator).host === hostHeader
  } catch {
    return false
  }
}
