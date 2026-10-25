const hasBuffer = typeof Buffer !== 'undefined'
const textEncoder = new TextEncoder()

const MIN_SCRATCH_SIZE = 64 * 1024
const MAX_SCRATCH_SIZE = 4 * 1024 * 1024

let scratch: Uint8Array | undefined

/**
 * Encode a rendered document, given as chunks, into one UTF-8 buffer. Each chunk is written
 * separately, so a non-Latin1 character only affects the encoding speed of its own chunk.
 *
 * Documents are encoded through a reused buffer of at most 4MiB; larger documents get a
 * buffer of their own, which is not retained.
 */
export function encodeDocument (chunks: string[]): Uint8Array<ArrayBuffer> {
  let length = 0
  for (const chunk of chunks) { length += chunk.length }
  // UTF-8 needs at most 3 bytes per UTF-16 code unit
  const needed = length * 3
  if (needed > MAX_SCRATCH_SIZE) {
    return hasBuffer ? encodeExact(chunks) : encodeVia(chunks, new Uint8Array(needed))
  }
  if (!scratch || scratch.length < needed) {
    const size = Math.min(MAX_SCRATCH_SIZE, Math.max(needed, MIN_SCRATCH_SIZE, (scratch?.length ?? 0) * 2))
    scratch = hasBuffer ? Buffer.allocUnsafeSlow(size) : new Uint8Array(size)
  }
  return encodeVia(chunks, scratch)
}

/** Write each chunk in turn, rewriting a high surrogate that ends a chunk with the chunk after it. */
function writeChunks (chunks: string[], write: (chunk: string, offset: number) => number): number {
  let offset = 0
  let carry = ''
  for (let chunk of chunks) {
    if (carry) {
      chunk = carry + chunk
      carry = ''
    }
    offset += write(chunk, offset)
    // checked once written, when the chunk is already flat; a lone high surrogate is written as U+FFFD
    const last = chunk.charCodeAt(chunk.length - 1)
    if (last >= 0xD800 && last <= 0xDBFF) {
      offset -= 3
      carry = chunk.slice(-1)
    }
  }
  if (carry) {
    offset += write(carry, offset)
  }
  return offset
}

function encodeVia (chunks: string[], target: Uint8Array): Uint8Array<ArrayBuffer> {
  if (hasBuffer) {
    const offset = writeChunks(chunks, (chunk, offset) => (target as Buffer).write(chunk, offset))
    return Buffer.from(target.subarray(0, offset)) as Uint8Array<ArrayBuffer>
  }
  const offset = writeChunks(chunks, (chunk, offset) => textEncoder.encodeInto(chunk, target.subarray(offset)).written)
  return target.slice(0, offset) as Uint8Array<ArrayBuffer>
}

function encodeExact (chunks: string[]): Uint8Array<ArrayBuffer> {
  let size = 0
  for (const chunk of chunks) { size += Buffer.byteLength(chunk) }
  const bytes = Buffer.allocUnsafe(size)
  return bytes.subarray(0, writeChunks(chunks, (chunk, offset) => bytes.write(chunk, offset))) as Uint8Array<ArrayBuffer>
}
