import type { H3Event } from 'nitro/h3'
import { isLoopbackAddress } from 'nuxt/internal/dev/peer'

export const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/** Whether the connected peer is a loopback address. */
export function isLoopbackPeer (event: H3Event): boolean {
  return isLoopbackAddress(event.req.ip)
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
