/**
 * Peer checks shared by the dev-only endpoints that disclose local state.
 *
 * @module nuxt/internal/dev/peer
 */

/** Header the dev server in front sets, to {@link DEV_PEER_TOKEN_ENV}, on requests from a loopback peer. */
export const DEV_PEER_HEADER = 'x-nuxt-dev-peer'

/** Environment variable holding the value the dev server in front sets {@link DEV_PEER_HEADER} to. */
export const DEV_PEER_TOKEN_ENV = 'NUXT_DEV_PEER_TOKEN'

/**
 * Whether the dev server in front vouched for a request as coming from a loopback peer.
 * The app's own socket only ever sees that server, so its address says nothing about the client.
 */
export function isVouchedLoopbackPeer (header: string | undefined | null): boolean {
  const token = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env[DEV_PEER_TOKEN_ENV]
  if (!token || typeof header !== 'string' || header.length !== token.length) {
    return false
  }
  let difference = 0
  for (let i = 0; i < token.length; i++) {
    difference |= token.charCodeAt(i) ^ header.charCodeAt(i)
  }
  return difference === 0
}

/**
 * Whether the connected peer is a loopback address.
 *
 * This inspects the TCP peer address rather than request metadata, so a
 * non-browser client cannot make itself look local by choosing its `Host`,
 * `Origin`, `Referer` or `Sec-Fetch-*` headers. `x-forwarded-for` is ignored on
 * purpose: only the address of the socket we are actually talking to counts.
 */
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
