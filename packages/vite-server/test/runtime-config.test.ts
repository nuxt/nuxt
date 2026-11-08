import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'

import { RUNTIME_CONFIG_ID, RuntimeConfigPlugin } from '../src/runtime-config.ts'

function load (consumer: 'client' | 'server') {
  const nuxt = {
    options: {
      runtimeConfig: { secret: 'hunter2', port: 3000, app: { baseURL: '/' }, public: { site: 'a' } },
      _runtimeConfigSchemas: [{ path: ['token'], node: 's', required: true }],
    },
  } as unknown as Nuxt
  const plugin = RuntimeConfigPlugin(nuxt)
  const id = (plugin.resolveId as (id: string) => string)(RUNTIME_CONFIG_ID)
  return (plugin.load as (this: unknown, id: string) => string).call({ environment: { config: { consumer } } }, id)
}

describe('RuntimeConfigPlugin', () => {
  it('should apply the environment to the whole runtime config on the server', () => {
    expect(load('server')).toMatchInlineSnapshot(`
      "import { createRuntimeConfig } from 'nuxt/internal/runtime-config'
      export const useRuntimeConfig = /* @__PURE__ */ createRuntimeConfig({"secret":"hunter2","port":3000,"app":{"baseURL":"/"},"public":{"site":"a"}}, {"p":{"secret":"s","port":"n","app":{"p":{"baseURL":"s"}},"public":{"p":{"site":"s"}},"token":"s"},"r":["token"]})"
    `)
  })

  it('should only serialise app and public config for the client', () => {
    expect(load('client')).toMatchInlineSnapshot(`
      "const config = {"app":{"baseURL":"/"},"public":{"site":"a"}}
      export const useRuntimeConfig = () => globalThis.__NUXT__?.config || config"
    `)
  })
})
