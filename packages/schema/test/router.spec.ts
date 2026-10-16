import { describe, expect, it, vi } from 'vitest'
import { applyDefaults } from 'untyped'

import { NuxtConfigSchema } from '../src/index.ts'
import type { NuxtOptions } from '../src/index.ts'

vi.mock('node:fs', () => ({
  existsSync: (id: string) => id.endsWith('app'),
}))

describe('router.options.sensitive default', () => {
  it('defaults to `true`', async () => {
    const result = await applyDefaults(NuxtConfigSchema, {})
    expect((result as unknown as NuxtOptions).router.options.sensitive).toBe(true)
  })

  it('respects an explicit `false` value', async () => {
    const result = await applyDefaults(NuxtConfigSchema, { router: { options: { sensitive: false } } })
    expect((result as unknown as NuxtOptions).router.options.sensitive).toBe(false)
  })
})
