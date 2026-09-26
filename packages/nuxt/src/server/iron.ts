/**
 * The one module that names the sealing primitive.
 *
 * TODO: move to `iron-webcrypto/gcm` (AES-256-GCM + HKDF) once published; see
 * https://github.com/brc-dd/iron-webcrypto.
 *
 * @internal
 */
import { defaults, seal as ironSeal, unseal as ironUnseal } from 'iron-webcrypto'

import type { SessionPassword } from './session'

export interface SealOptions {
  /** Milliseconds; `0` for no expiry. */
  ttl?: number
}

export function seal (value: unknown, password: SessionPassword, options?: SealOptions): Promise<string> {
  return ironSeal(value, password, { ...defaults, ttl: options?.ttl ?? 0 })
}

export function unseal (sealed: string, password: SessionPassword, options?: SealOptions): Promise<unknown> {
  return ironUnseal(sealed, password, { ...defaults, ttl: options?.ttl ?? 0 })
}
