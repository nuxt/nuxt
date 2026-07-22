import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'

import '../src/impl.ts'
import { getEnv } from '../src/presets/base.ts'
import { createWebpackConfigContext } from '../src/utils/config.ts'
import type { WebpackConfigContext } from '../src/utils/config.ts'

function createContext (compatibilityVersion: 4 | 5, isClient: boolean): WebpackConfigContext {
  const nuxt = {
    _version: '5.0.0-0',
    options: {
      future: { compatibilityVersion },
      dev: false,
      test: false,
      envName: 'production',
      logLevel: 'info',
      experimental: { asyncContext: false },
      webpack: {},
      app: { buildAssetsDir: '_nuxt', baseURL: '/' },
    },
  } as Nuxt

  const ctx = createWebpackConfigContext(nuxt)
  ctx.isClient = isClient
  ctx.isServer = !isClient
  ctx.config = { mode: 'production' }
  ctx.name = isClient ? 'client' : 'server'
  return ctx
}

describe('webpack build env defines', () => {
  it('includes legacy process flags for compatibilityVersion 4', () => {
    const env = getEnv(createContext(4, true))
    expect(env).toMatchObject({
      'process.dev': false,
      'process.test': false,
      'process.browser': true,
      'process.client': true,
      'process.server': false,
      'import.meta.client': true,
    })
  })

  it('omits deprecated process flags for compatibilityVersion 5', () => {
    const env = getEnv(createContext(5, true))
    expect(env).not.toHaveProperty('process.dev')
    expect(env).not.toHaveProperty('process.test')
    expect(env).not.toHaveProperty('process.browser')
    expect(env).not.toHaveProperty('process.client')
    expect(env).not.toHaveProperty('process.server')
    expect(env).toMatchObject({
      'import.meta.client': true,
      'process.prerender': false,
      'process.nitro': false,
    })
  })

  it('keeps runtime process.prerender and process.nitro on server builds', () => {
    const env = getEnv(createContext(5, false))
    expect(env['process.prerender']).toBe('(()=>process.prerender)()')
    expect(env['process.nitro']).toBe('(()=>process.nitro)()')
  })
})
