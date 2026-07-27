import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NuxtSSRContext } from 'nuxt/app'

import { getPayloadKeySizes, renderPayloadJsonScript } from '../src/runtime/utils/renderer/payload.ts'

function ssrContext (url = '/') {
  return {
    url,
    'config': {},
    '~payloadReducers': {},
  } as unknown as NuxtSSRContext
}

describe('getPayloadKeySizes', () => {
  it('returns keys sorted by serialized size', () => {
    const sizes = getPayloadKeySizes({
      small: 'a',
      large: 'x'.repeat(100),
      medium: 'y'.repeat(10),
    }, {})

    expect(sizes.map(([key]) => key)).toEqual(['large', 'medium', 'small'])
  })

  it('skips values that cannot be stringified', () => {
    const sizes = getPayloadKeySizes({
      fn: () => {},
      ok: 'value',
    }, {})

    expect(sizes.map(([key]) => key)).toEqual(['ok'])
  })
})

describe('renderPayloadJsonScript (dev)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('warns once about large payloads with the largest keys', () => {
    vi.stubGlobal('__TEST_DEV__', true)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const data = { data: { big: 'z'.repeat(200 * 1024), small: 'tiny' } }
    renderPayloadJsonScript({ ssrContext: ssrContext('/large'), data })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('NUXT_E8006'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`big`'))

    warn.mockClear()
    renderPayloadJsonScript({ ssrContext: ssrContext('/large'), data })
    expect(warn).not.toHaveBeenCalled()
  })

  it('does not warn for small payloads', () => {
    vi.stubGlobal('__TEST_DEV__', true)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    renderPayloadJsonScript({ ssrContext: ssrContext('/small'), data: { data: { key: 'value' } } })
    expect(warn).not.toHaveBeenCalled()
  })
})
