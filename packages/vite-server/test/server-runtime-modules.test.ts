import { createHooks } from 'hookable'
import { describe, expect, it, vi } from 'vitest'
import type { NuxtServerRuntime } from '@nuxt/kit/internal'
import type { Nuxt, NuxtHooks } from '@nuxt/schema'
import type { ViteDevServer } from 'vite'

import { ServerRuntimeModulesPlugin } from '../src/ssr.ts'

function setup ({ dev = true } = {}) {
  const contents: Record<string, string> = { '#template': 'export const a = 1', 'nuxt/internal/renderer-config': 'export const b = 1' }
  const hooks = createHooks<NuxtHooks>()
  const nuxt = {
    options: { dev, _serverTemplates: { '#template': () => contents['#template']! } },
    hook: hooks.hook.bind(hooks),
  } as unknown as Nuxt
  const serverRuntime = {
    modules: Object.fromEntries(Object.keys(contents).map(specifier => [specifier, { code: () => contents[specifier]! }])),
  } as unknown as NuxtServerRuntime

  const plugin = ServerRuntimeModulesPlugin(nuxt, serverRuntime)
  const resolveId = (plugin.resolveId as { handler: (id: string) => string | undefined }).handler
  const loadHandler = (plugin.load as { handler: (id: string) => Promise<{ code: string } | undefined> }).handler
  const load = async (specifier: string) => (await loadHandler(resolveId(specifier)!))?.code

  const reloadModule = vi.fn()
  const ssr = { moduleGraph: { getModuleById: (id: string) => ({ id }) }, reloadModule }
  const client = { moduleGraph: { getModuleById: () => undefined }, reloadModule }
  ;(plugin.configureServer as (server: ViteDevServer) => void)({ environments: { client, ssr } } as unknown as ViteDevServer)

  const regenerate = () => hooks.callHook('app:templatesGenerated', {} as never, [], undefined)

  return { contents, load, resolveId, regenerate, reloadModule }
}

describe('ServerRuntimeModulesPlugin', () => {
  it('should reload a loaded server template once its contents have changed', async () => {
    const { contents, load, resolveId, regenerate, reloadModule } = setup()
    expect(await load('#template')).toBe('export const a = 1')

    await regenerate()
    expect(reloadModule).not.toHaveBeenCalled()

    contents['#template'] = 'export const a = 2'
    await regenerate()
    expect(reloadModule).toHaveBeenCalledExactlyOnceWith({ id: resolveId('#template') })

    await regenerate()
    expect(reloadModule).toHaveBeenCalledTimes(1)
  })

  it('should not reload a server template that has not been loaded, or any other module', async () => {
    const { contents, load, regenerate, reloadModule } = setup()
    await load('nuxt/internal/renderer-config')

    contents['#template'] = 'export const a = 2'
    contents['nuxt/internal/renderer-config'] = 'export const b = 2'
    await regenerate()
    expect(reloadModule).not.toHaveBeenCalled()
  })

  it('should not reload modules outside development', async () => {
    const { contents, load, regenerate, reloadModule } = setup({ dev: false })
    await load('#template')

    contents['#template'] = 'export const a = 2'
    await regenerate()
    expect(reloadModule).not.toHaveBeenCalled()
  })
})
