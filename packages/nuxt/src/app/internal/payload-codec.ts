function deriveSeed (key: string): { keyBytes: Uint8Array, seed: number } {
  const keyBytes = new TextEncoder().encode(key)
  let seed = 0x811C9DC5
  for (let i = 0; i < keyBytes.length; i++) {
    seed ^= keyBytes[i]!
    seed = Math.imul(seed, 0x01000193) >>> 0
  }
  return { keyBytes, seed: seed || 0x9E3779B9 }
}

function xorWithKeystream (bytes: Uint8Array, key: string): Uint8Array {
  const { keyBytes, seed } = deriveSeed(key)
  const out = new Uint8Array(bytes.length)
  let state = seed
  const keyLen = keyBytes.length || 1
  for (let i = 0; i < bytes.length; i++) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state = (state >>> 0) || 0x9E3779B9
    const k = keyBytes[i % keyLen] ?? 0
    out[i] = bytes[i]! ^ ((state ^ k) & 0xFF)
  }
  return out
}

function toBase64Url (bytes: Uint8Array): string {
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function fromBase64Url (encoded: string): Uint8Array {
  const base64 = encoded.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Scramble a serialized payload string into a URL-safe, HTML-safe opaque token using a build key.
 * @internal
 */
export function encodePayload (plainText: string, key: string): string {
  if (!plainText || !key) { return plainText }
  return toBase64Url(xorWithKeystream(new TextEncoder().encode(plainText), key))
}

/**
 * Restore a serialized payload string produced by {@link encodePayload}.
 * @internal
 */
export function decodePayload (encoded: string, key: string): string {
  if (!encoded || !key) { return encoded }
  return new TextDecoder().decode(xorWithKeystream(fromBase64Url(encoded), key))
}

function resolvePlainDevalueValue (values: unknown[], index: unknown): unknown {
  if (typeof index !== 'number') { return index }
  if (index === -1 || index === -2) { return undefined }
  if (index === -3) { return Number.NaN }
  if (index === -4) { return Number.POSITIVE_INFINITY }
  if (index === -5) { return Number.NEGATIVE_INFINITY }
  if (index === -6) { return -0 }
  if (index < 0 || index >= values.length) { return undefined }
  const val = values[index]
  if (!val || typeof val !== 'object') { return val }
  if (Array.isArray(val)) {
    return val.map(item => resolvePlainDevalueValue(values, item))
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(val)) {
    out[k] = resolvePlainDevalueValue(values, v)
  }
  return out
}

/**
 * Synchronously read `serverRendered` and `config` from an inline devalue payload script without
 * needing custom payload revivers or touching reactive payload containers.
 * @internal
 */
export function readInlineBootMeta (rawText: string, obfuscationKey: string | false): { serverRendered?: boolean, config?: Record<string, any> } | undefined {
  try {
    const decoded = obfuscationKey ? decodePayload(rawText, obfuscationKey) : rawText
    const values = JSON.parse(decoded) as unknown[]
    const root = Array.isArray(values) && values[0] && typeof values[0] === 'object' ? values[0] as Record<string, unknown> : undefined
    if (!root) { return undefined }
    return {
      serverRendered: 'serverRendered' in root ? Boolean(resolvePlainDevalueValue(values, root.serverRendered)) : undefined,
      config: 'config' in root ? resolvePlainDevalueValue(values, root.config) as Record<string, any> : undefined,
    }
  } catch {
    return undefined
  }
}
