import { hasProtocol } from 'ufo'

/** @internal */
export function isCrossOriginURL (url: string, base: string | URL): boolean {
  if (!hasProtocol(url, { acceptRelative: true })) {
    return false
  }
  try {
    return new URL(url, base).origin !== new URL(base).origin
  } catch {
    return true
  }
}
