import { describe, expect, it, vi } from 'vitest'
import { applyDefaults } from 'untyped'

import { NuxtConfigSchema } from '../src/index.ts'
import type { NuxtOptions } from '../src/index.ts'

vi.mock('node:fs', () => ({
  existsSync: (id: string) => id.endsWith('app'),
}))

describe('experimental.watcher default', () => {
  it('defaults to `builder` when compatibilityVersion is 5', async () => {
    const result = await applyDefaults(NuxtConfigSchema, { future: { compatibilityVersion: 5 } })
    expect((result as unknown as NuxtOptions).experimental.watcher).toBe('builder')
  })

  it('defaults to `chokidar-granular` for v3-style layout (srcDir === rootDir)', async () => {
    const result = await applyDefaults(NuxtConfigSchema, { future: { compatibilityVersion: 3 }, srcDir: '/test', rootDir: '/test' })
    expect((result as unknown as NuxtOptions).experimental.watcher).toBe('chokidar-granular')
  })

  it('defaults to `chokidar` for v3 when srcDir differs from rootDir', async () => {
    const result = await applyDefaults(NuxtConfigSchema, { future: { compatibilityVersion: 3 }, srcDir: 'src/', rootDir: '/test' })
    expect((result as unknown as NuxtOptions).experimental.watcher).toBe('chokidar')
  })

  it('respects an explicit string value', async () => {
    const result = await applyDefaults(NuxtConfigSchema, { future: { compatibilityVersion: 5 }, experimental: { watcher: 'parcel' } })
    expect((result as unknown as NuxtOptions).experimental.watcher).toBe('parcel')
  })
})

describe('experimental.parseErrorData', () => {
  it('is forced on with compatibilityVersion 5, and says so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await applyDefaults(NuxtConfigSchema, { future: { compatibilityVersion: 5 }, experimental: { parseErrorData: false } })

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect((result as unknown as NuxtOptions).experimental.parseErrorData).toBe(true)
    expect(warn.mock.calls.map(call => String(call[0])).join('\n')).toContain('NUXT_B5016')
    warn.mockRestore()
  })

  it('is still configurable with compatibilityVersion 4, without complaining', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await applyDefaults(NuxtConfigSchema, { future: { compatibilityVersion: 4 }, experimental: { parseErrorData: false } })

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect((result as unknown as NuxtOptions).experimental.parseErrorData).toBe(false)
    expect(warn.mock.calls.map(call => String(call[0])).join('\n')).not.toContain('NUXT_B5016')
    warn.mockRestore()
  })

  it('defaults to true', async () => {
    const result = await applyDefaults(NuxtConfigSchema, { future: { compatibilityVersion: 4 } })

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect((result as unknown as NuxtOptions).experimental.parseErrorData).toBe(true)
  })
})
