import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { deriveSecret } from '../src/server/index'

const runtimeConfig = vi.hoisted(() => ({ appSecret: '' as unknown }))

vi.mock('nuxt/internal/server-runtime-config', () => ({
  useRuntimeConfig: () => runtimeConfig,
}))

describe('`deriveSecret`', () => {
  beforeEach(() => {
    runtimeConfig.appSecret = 'a'.repeat(32)
  })

  it('resolves 32 hex-encoded bytes, the same for a purpose and different across purposes', async () => {
    const [a, b, c] = await Promise.all([deriveSecret('one'), deriveSecret('one'), deriveSecret('two')])
    expect(a).toMatch(/^[\da-f]{64}$/)
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })

  it.for([[''], ['short'], [undefined]])('rejects an unusable `appSecret`: %j', async ([value]) => {
    runtimeConfig.appSecret = value
    await expect(deriveSecret('purpose')).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining('is not set'),
    })
  })

  it.for([[42], [true], [{ key: 'secret' }]])('explains that Nitro parsed the `appSecret`: %j', async ([value]) => {
    runtimeConfig.appSecret = value
    await expect(deriveSecret('purpose')).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining('parses environment overrides'),
    })
  })
})

describe('`deriveSecret` in development', () => {
  afterEach(() => {
    delete process.env.NUXT_APP_SECRET_GENERATED
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  async function load () {
    vi.stubGlobal('__TEST_DEV__', true)
    vi.resetModules()
    return (await import('../src/server/secret')).deriveSecret
  }

  it('warns once per process when the generated secret is used', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const derive = await load()
    runtimeConfig.appSecret = '0123456789abcdef'.repeat(4)
    process.env.NUXT_APP_SECRET_GENERATED = '1'

    await derive('one')
    await derive('two')

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]!.join(' ')).toContain('NUXT_B5028')
  })

  it('does not warn for a configured secret', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const derive = await load()
    runtimeConfig.appSecret = '0123456789abcdef'.repeat(4)

    await derive('one')

    expect(warn).not.toHaveBeenCalled()
  })
})
