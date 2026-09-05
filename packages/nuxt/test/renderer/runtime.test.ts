import { describe, expect, it } from 'vitest'

import { serverRuntime, setServerRuntime } from '../../src/runtime/server/renderer/runtime.ts'
import type { NuxtRendererOptions } from '../../src/runtime/server/renderer/runtime.ts'

const options: NuxtRendererOptions = {
  runtimeConfig: () => ({}) as ReturnType<NuxtRendererOptions['runtimeConfig']>,
  buildAssetsURL: () => '/',
  publicAssetsURL: () => '/',
  getRouteRules: () => ({}),
  hooks: () => ({ callHook: () => {} }) as unknown as ReturnType<NuxtRendererOptions['hooks']>,
  createResponse: body => new Response(body),
  createError: init => new Error(init.statusText),
}

describe('setServerRuntime', () => {
  it('installs the options the renderer modules read', () => {
    setServerRuntime({ ...options, writeEarlyHints: () => {} })

    expect(serverRuntime.getRouteRules).toBe(options.getRouteRules)
    expect(serverRuntime.writeEarlyHints).toBeTypeOf('function')
  })

  it('drops the capabilities the options it replaces provided', () => {
    setServerRuntime({
      ...options,
      renderIsland: () => new Response(),
      writeEarlyHints: () => {},
      prerender: { payloadCache: {} as NonNullable<NuxtRendererOptions['prerender']>['payloadCache'] },
    })
    setServerRuntime(options)

    expect(serverRuntime.renderIsland).toBeUndefined()
    expect(serverRuntime.writeEarlyHints).toBeUndefined()
    expect(serverRuntime.prerender).toBeUndefined()
  })
})
