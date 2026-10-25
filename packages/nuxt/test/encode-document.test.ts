import { afterEach, describe, expect, it, vi } from 'vitest'

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes)
const byteLength = (value: string) => new TextEncoder().encode(value).byteLength

describe.each([
  ['with Buffer', false],
  ['without Buffer', true],
])('encodeDocument %s', (_, stubBuffer) => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function load () {
    if (stubBuffer) {
      vi.stubGlobal('Buffer', undefined)
    }
    vi.resetModules()
    const { encodeDocument } = await import('../src/runtime/server/renderer/encode')
    return encodeDocument
  }

  it('encodes chunks as their concatenation', async () => {
    const encodeDocument = await load()
    const chunks = ['<!DOCTYPE html><html>', '<p>plain</p>', '<p>View →</p>', '<p>日本語 😀</p>', '</html>']
    expect(decode(encodeDocument(chunks))).toBe(chunks.join(''))
  })

  it('keeps a surrogate pair split across chunks', async () => {
    const encodeDocument = await load()
    const high = '😀'.charAt(0)
    const low = '😀'.charAt(1)
    expect(decode(encodeDocument(['<p>', high, '', low, '</p>']))).toBe('<p>😀</p>')
    expect(decode(encodeDocument(['<p>', high]))).toBe('<p>\uFFFD')
  })

  it('handles empty input and empty chunks', async () => {
    const encodeDocument = await load()
    expect(encodeDocument([]).byteLength).toBe(0)
    expect(decode(encodeDocument(['', 'a', '']))).toBe('a')
  })

  it.each([
    ['within the reused buffer', 10],
    ['larger than the reused buffer', 20],
  ])('encodes a document %s', async (_, count) => {
    const encodeDocument = await load()
    const chunk = 'x'.repeat(100_000) + '→'
    const chunks = Array.from({ length: count }, () => chunk)
    encodeDocument(['small'])
    const bytes = encodeDocument(chunks)
    expect(bytes.byteLength).toBe(byteLength(chunks.join('')))
    expect(decode(bytes)).toBe(chunks.join(''))
  })

  it('returns bytes that are independent of later calls', async () => {
    const encodeDocument = await load()
    const first = encodeDocument(['first'])
    encodeDocument(['second'])
    expect(decode(first)).toBe('first')
  })
})
