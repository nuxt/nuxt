import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes)
const nodeVersion = process.versions.node

function stubNodeVersion (version: string) {
  Object.defineProperty(process.versions, 'node', { value: version, configurable: true })
}

afterEach(() => {
  stubNodeVersion(nodeVersion)
  vi.restoreAllMocks()
})

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
    const [high, low] = '😀'.split('')
    const chunk = low + 'x'.repeat(100_000) + '→' + high
    const chunks = Array.from({ length: count }, () => chunk)
    encodeDocument(['small'])
    const bytes = encodeDocument(chunks)
    const expected = new TextEncoder().encode(chunks.join(''))
    expect(bytes.byteLength).toBe(expected.byteLength)
    expect(decode(bytes)).toBe(decode(expected))
  })

  it.each([
    ['ASCII', 'x'],
    ['Latin1', 'é'],
    ['non-Latin1', '日本語 →'],
    ['a surrogate pair', '😀'],
    ['a lone surrogate', '\uD83D x \uDE00'],
  ])('encodes a large chunk containing %s', async (_, content) => {
    const chunk = '<p>' + 'a'.repeat(5000) + content + 'b'.repeat(5000) + '</p>'
    const expected = new TextEncoder().encode(`<html>${chunk}😀${chunk}</html>`)
    for (const version of ['24.0.0', '26.8.0']) {
      stubNodeVersion(version)
      const encodeDocument = await load()
      expect(new Uint8Array(encodeDocument(['<html>', chunk, '😀', chunk, '</html>']))).toEqual(expected)
    }
  })

  it('returns bytes that are independent of later calls', async () => {
    const encodeDocument = await load()
    const first = encodeDocument(['first'])
    encodeDocument(['second'])
    expect(decode(first)).toBe('first')
  })
})

describe('encodeDocument transcoder', () => {
  it.each([
    ['loads', '24.13.0', 1],
    ['loads', '26.7.0', 1],
    ['skips', '26.8.0', 0],
    ['skips', '27.0.0', 0],
  ])('%s the ICU transcoder on Node %s', async (_, version, calls) => {
    stubNodeVersion(version)
    const getBuiltinModule = vi.spyOn(process, 'getBuiltinModule')
    vi.resetModules()
    await import('../src/runtime/server/renderer/encode')
    expect(getBuiltinModule).toHaveBeenCalledTimes(calls)
  })
})
