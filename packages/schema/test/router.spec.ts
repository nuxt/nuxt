import { describe, expect, it, vi } from 'vitest'
import { applyDefaults } from 'untyped'

import { NuxtConfigSchema } from '../src/index.ts'
import type { NuxtOptions } from '../src/index.ts'

vi.mock('node:fs', () => ({
  existsSync: (id: string) => id.endsWith('app'),
}))

describe('router.options.sensitive default', () => {
  it('defaults to `true` when compatibilityVersion is 5', async () => {
    const result = await applyDefaults(NuxtConfigSchema, { future: { compatibilityVersion: 5 } })
    expect((result as unknown as NuxtOptions).router.options.sensitive).toBe(true)
  })

  it('defaults to `false` when compatibilityVersion is 4', async () => {
    const result = await applyDefaults(NuxtConfigSchema, { future: { compatibilityVersion: 4 } })
    expect((result as unknown as NuxtOptions).router.options.sensitive).toBe(false)
  })

  it('respects an explicit `false` value in v5', async () => {
    const result = await applyDefaults(NuxtConfigSchema, { future: { compatibilityVersion: 5 }, router: { options: { sensitive: false } } })
    expect((result as unknown as NuxtOptions).router.options.sensitive).toBe(false)
  })

  it('respects an explicit `true` value in v4', async () => {
    const result = await applyDefaults(NuxtConfigSchema, { future: { compatibilityVersion: 4 }, router: { options: { sensitive: true } } })
    expect((result as unknown as NuxtOptions).router.options.sensitive).toBe(true)
  })
})
