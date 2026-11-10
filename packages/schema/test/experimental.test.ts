import { describe, expect, it, vi } from 'vitest'
import { applyDefaults } from 'untyped'

import { NuxtConfigSchema } from '../src/index.ts'
import type { NuxtOptions } from '../src/index.ts'

vi.mock('node:fs', () => ({
  existsSync: (id: string) => id.endsWith('app'),
}))

describe('future.compatibilityVersion', () => {
  it('resolves to 5 without complaining when unset or set to 5', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const future of [{}, { compatibilityVersion: 5 }]) {
      const result = await applyDefaults(NuxtConfigSchema, { future })
      expect((result as unknown as NuxtOptions).future.compatibilityVersion).toBe(5)
    }
    expect(warn.mock.calls.map(call => String(call[0])).join('\n')).not.toContain('NUXT_B5029')
    warn.mockRestore()
  })

  it.each([4, 3, 6, '4'])('is forced to 5 when set to %j, and says so', async (compatibilityVersion) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await applyDefaults(NuxtConfigSchema, { future: { compatibilityVersion } })
    expect((result as unknown as NuxtOptions).future.compatibilityVersion).toBe(5)
    expect(warn.mock.calls.map(call => String(call[0])).join('\n')).toContain('NUXT_B5029')
    warn.mockRestore()
  })

  it('does not revert other defaults when set to 4', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await applyDefaults(NuxtConfigSchema, { future: { compatibilityVersion: 4 } }) as unknown as NuxtOptions
    expect(result.router.options.sensitive).toBe(true)
    expect(result.experimental.typedPages).toBe(true)
    expect(result.experimental.asyncCallHook).toBe(false)
    expect(result.vue.optionsApi).toBe(false)
    warn.mockRestore()
  })
})

describe('experimental.watcher default', () => {
  it('defaults to `builder`', async () => {
    const result = await applyDefaults(NuxtConfigSchema, { srcDir: '/test', rootDir: '/test' })
    expect((result as unknown as NuxtOptions).experimental.watcher).toBe('builder')
  })

  it('respects an explicit string value', async () => {
    const result = await applyDefaults(NuxtConfigSchema, { experimental: { watcher: 'parcel' } })
    expect((result as unknown as NuxtOptions).experimental.watcher).toBe('parcel')
  })
})

describe('experimental.prerenderErrorPages', () => {
  it('keeps client and server error status codes', async () => {
    const result = await applyDefaults(NuxtConfigSchema, { experimental: { prerenderErrorPages: [404, 500] } })
    expect((result as unknown as NuxtOptions).experimental.prerenderErrorPages).toEqual([404, 500])
  })

  it('drops status codes that cannot be error pages, and says so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await applyDefaults(NuxtConfigSchema, { experimental: { prerenderErrorPages: [200, 404.5, 404] } })

    expect((result as unknown as NuxtOptions).experimental.prerenderErrorPages).toEqual([404])
    expect(warn.mock.calls.map(call => String(call[0])).join('\n')).toContain('NUXT_B5020')
    warn.mockRestore()
  })
})

describe('experimental.parseErrorData', () => {
  it('is forced on, and says so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await applyDefaults(NuxtConfigSchema, { experimental: { parseErrorData: false } })

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect((result as unknown as NuxtOptions).experimental.parseErrorData).toBe(true)
    expect(warn.mock.calls.map(call => String(call[0])).join('\n')).toContain('NUXT_B5016')
    warn.mockRestore()
  })

  it('defaults to true without complaining', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await applyDefaults(NuxtConfigSchema, {})
    expect(warn.mock.calls.map(call => String(call[0])).join('\n')).not.toContain('NUXT_B5016')
    warn.mockRestore()

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect((result as unknown as NuxtOptions).experimental.parseErrorData).toBe(true)
  })
})
