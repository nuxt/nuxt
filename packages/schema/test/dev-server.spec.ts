import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyDefaults } from 'untyped'

import { NuxtConfigSchema } from '../src/index.ts'
import type { NuxtOptions } from '../src/index.ts'

async function resolveAllowedHosts (config: { devServer?: { host?: string, allowedHosts?: string[] | true }, vite?: { server?: { allowedHosts?: string[] | true } } }) {
  const result = await applyDefaults(NuxtConfigSchema, config) as unknown as NuxtOptions
  return result.devServer.allowedHosts
}

describe('devServer.host', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to undefined', async () => {
    for (const key of ['NUXT_HOST', 'NITRO_HOST', 'HOST']) {
      vi.stubEnv(key, '')
    }
    const result = await applyDefaults(NuxtConfigSchema, {}) as unknown as NuxtOptions
    expect(result.devServer.host).toBeUndefined()
  })
})

describe('devServer.allowedHosts', () => {
  it('defaults to an empty list', async () => {
    expect(await resolveAllowedHosts({})).toEqual([])
  })

  it('includes devServer.host and vite.server.allowedHosts', async () => {
    expect(await resolveAllowedHosts({
      devServer: { host: 'my-machine.lan', allowedHosts: ['.example.com'] },
      vite: { server: { allowedHosts: ['proxy.test', 'my-machine.lan'] } },
    })).toEqual(['.example.com', 'proxy.test', 'my-machine.lan'])
  })

  it('includes devServer.host when no other option lists it', async () => {
    expect(await resolveAllowedHosts({ devServer: { host: 'my-machine.lan' } })).toEqual(['my-machine.lan'])
  })

  it('allows any host when either option is true', async () => {
    expect(await resolveAllowedHosts({ devServer: { allowedHosts: true } })).toBe(true)
    expect(await resolveAllowedHosts({ vite: { server: { allowedHosts: true } } })).toBe(true)
  })
})
