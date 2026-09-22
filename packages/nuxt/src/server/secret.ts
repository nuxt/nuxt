import { useRuntimeConfig } from 'nuxt/internal/server-runtime-config'

import { createError } from '../app/error'

const MIN_LENGTH = 32
const SALT = new TextEncoder().encode('nuxt')

let warnedGenerated = false

/**
 * A secret for one purpose, derived from `appSecret` with HKDF-SHA256: 32 bytes,
 * hex-encoded. Stable while `appSecret` is unchanged; distinct for every purpose.
 * Namespace the purpose to what owns it, such as a module name.
 *
 * @example
 * ```ts
 * const password = await deriveSecret('nuxt-auth-utils:session')
 * ```
 *
 * @throws a `500` when `appSecret` is unset or shorter than 32 characters.
 * @since 5.0.0
 */
export async function deriveSecret (purpose: string): Promise<string> {
  const root = useRuntimeConfig().appSecret
  if (typeof root !== 'string' || root.length < MIN_LENGTH) {
    // Nitro parses environment overrides, so a digits-only or JSON-looking secret arrives
    // as a number, boolean or object, and the original string cannot be recovered here.
    const parsed = root !== undefined && root !== '' && typeof root !== 'string'
    throw createError({
      status: 500,
      message: parsed
        ? `\`appSecret\` was set to a ${Array.isArray(root) ? 'array' : typeof root}, because Nitro parses environment overrides. Quote the value (\`NUXT_APP_SECRET='"…"'\`) or set \`runtimeConfig.appSecret\` in \`nuxt.config\`.`
        : `\`appSecret\` is not set. Set \`NUXT_APP_SECRET\` to at least ${MIN_LENGTH} characters, or pass a secret explicitly.`,
    })
  }

  if (import.meta.dev && !warnedGenerated && globalThis.process?.env?.NUXT_APP_SECRET_GENERATED === '1') {
    warnedGenerated = true
    // eslint-disable-next-line no-restricted-syntax
    console.warn('[nuxt] [NUXT_B5028] A generated development `appSecret` is being used. Set `NUXT_APP_SECRET` in your `.env` to the output of `openssl rand -base64 32`. Builds do not generate a secret.')
  }

  const encoder = new TextEncoder()
  const key = await globalThis.crypto.subtle.importKey('raw', encoder.encode(root), 'HKDF', false, ['deriveBits'])
  const bits = await globalThis.crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: encoder.encode(purpose) }, key, 256)
  return [...new Uint8Array(bits)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
