import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

import { isDev, runsOncePerEnvInMatrix } from './matrix'

const shouldRun = runsOncePerEnvInMatrix

if (shouldRun) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/nitro-legacy', import.meta.url)),
    dev: isDev,
    server: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(!shouldRun)('nitro v2 compatibility', () => {
  it('runs a v2-tagged module handler on nitro v3', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/v2-module')).toMatchObject({
      flavour: 'earl-grey',
      secret: 'legacy-secret',
      hasNodeBridge: true,
      hasNitroContext: true,
      hasStorage: true,
    })
  })

  it('resolves `nitro/*` specifiers emitted into a module virtual module', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/v3-module')).toMatchObject({
      hasCachedHandler: true,
      probe: 'specific-alias',
      nodeProbe: 'node-suffixed-alias',
    })
  })

  it('runs the variant this server prefers, of a route registered once per server API', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/variant?q=1')).toEqual({ variant: 'nuxt', query: '1' })
  })

  it('injects the v2 auto-imports into user server code', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/auto?q=1')).toMatchObject({
      flavour: 'earl-grey',
      fromQuery: '1',
    })
  })

  it('serialises `createError` from a v2-tagged module handler with the v2 keys', async () => {
    const error = await $fetch<Record<string, unknown>>('/api/v2-module?fail=1', { ignoreResponseError: true })
    expect(error).toMatchObject({
      statusCode: 418,
      statusMessage: 'I am a teapot',
      data: { from: 'v2-module' },
    })
  })

  it('runs a v1-style user handler with `nitroLegacy` enabled', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/v2-user')).toMatchObject({
      flavour: 'mutated-per-request',
      sharedFlavour: 'earl-grey',
      hasNodeBridge: true,
    })
  })

  it('serialises `createError` from a user handler with the v2 keys', async () => {
    const error = await $fetch<Record<string, unknown>>('/api/v2-user?fail=1', { ignoreResponseError: true })
    expect(error).toMatchObject({ statusCode: 422, statusMessage: 'Unprocessable', data: { from: 'user' } })
  })
})
