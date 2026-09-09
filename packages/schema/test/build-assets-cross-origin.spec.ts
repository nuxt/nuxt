import { describe, expect, it, vi } from 'vitest'
import { applyDefaults } from 'untyped'

import { NuxtConfigSchema } from '../src/index.ts'
import type { NuxtOptions } from '../src/index.ts'

vi.mock('node:fs', () => ({
  existsSync: (id: string) => id.endsWith('app'),
}))

describe('app.buildAssetsCrossOrigin', () => {
  it('defaults to anonymous CORS (empty string)', async () => {
    const result = await applyDefaults(NuxtConfigSchema, {})
    expect((result as unknown as NuxtOptions).app.buildAssetsCrossOrigin).toBe('')
  })

  it('accepts use-credentials and anonymous', async () => {
    const credentials = await applyDefaults(NuxtConfigSchema, { app: { buildAssetsCrossOrigin: 'use-credentials' } })
    expect((credentials as unknown as NuxtOptions).app.buildAssetsCrossOrigin).toBe('use-credentials')

    const anonymous = await applyDefaults(NuxtConfigSchema, { app: { buildAssetsCrossOrigin: 'anonymous' } })
    expect((anonymous as unknown as NuxtOptions).app.buildAssetsCrossOrigin).toBe('anonymous')
  })

  it('falls back to the default for unknown values', async () => {
    const result = await applyDefaults(NuxtConfigSchema, { app: { buildAssetsCrossOrigin: 'invalid' as never } })
    expect((result as unknown as NuxtOptions).app.buildAssetsCrossOrigin).toBe('')
  })
})
