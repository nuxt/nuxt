import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('#build/nuxt.config.mjs', () => ({
  appGlobalName: false,
  appId: 'demo"app\\x',
  appPayloadDataAttr: 'data-app.payload',
  appPayloadId: false,
  multiApp: false,
}))

const { findPayloadElement } = await import('../../src/app/internal/payload-access.ts')

describe('findPayloadElement selector escaping', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('locates payload element when appId contains quotes/backslashes and attr contains dots', () => {
    const matched = { getAttribute: (name: string) => name === 'data-app.payload' ? 'demo"app\\x' : null }
    const other = { getAttribute: () => 'other' }
    const querySelectorAll = vi.fn(() => [other, matched])
    vi.stubGlobal('document', { querySelectorAll })
    vi.stubGlobal('CSS', { escape: (val: string) => val.replaceAll('.', '\\.') })

    expect(findPayloadElement()).toBe(matched)
    expect(querySelectorAll).toHaveBeenCalledWith('[data-app\\.payload]')
  })
})
