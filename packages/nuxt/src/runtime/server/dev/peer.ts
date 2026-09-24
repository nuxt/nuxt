/**
 * Peer checks shared by the dev-only endpoints that disclose local state.
 *
 * @module nuxt/internal/dev/peer
 */

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
