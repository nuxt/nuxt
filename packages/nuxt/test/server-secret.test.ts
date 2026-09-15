import { beforeEach, describe, expect, it, vi } from 'vitest'

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

  it.for([[''], ['short'], [undefined], [42]])('rejects an unusable `appSecret`: %j', async ([value]) => {
    runtimeConfig.appSecret = value
    await expect(deriveSecret('purpose')).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining('NUXT_APP_SECRET'),
    })
  })
})
