import { createHooks } from 'hookable'
import type { Nuxt, ViteConfig as NuxtViteConfig } from 'nuxt/schema'
import { createServer } from 'vite'
import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import { describe, expect, it, vi } from 'vitest'

import { addVitePlugin } from '../src/build.ts'
import { runWithNuxtContext } from '../src/context.ts'

function createMockNuxt (dev: boolean) {
  const hooks = createHooks()
  return {
    hooks,
    hook: hooks.hook,
    callHook: hooks.callHook,
    options: {
      dev,
      build: false,
      vite: { mode: dev ? 'development' : 'production' },
    },
  } as unknown as Nuxt
}

async function addPlugins (nuxt: Nuxt, plugins: VitePlugin[], options?: Parameters<typeof addVitePlugin>[1]) {
  const config: ViteConfig = { plugins: [], environments: { client: {}, ssr: {} } }
  runWithNuxtContext(nuxt, () => addVitePlugin(plugins, options))
  await nuxt.callHook('vite:extend', { config } as any)
  return config.plugins as VitePlugin[]
}

function environment (name: string) {
  return { name, getTopLevelConfig: () => ({ command: 'build', mode: 'production' }) } as any
}

function appliesTo (plugin: VitePlugin, name: string) {
  return plugin.applyToEnvironment!(environment(name))
}

describe('addVitePlugin', () => {
  it('should add plugins to the top-level plugin array', async () => {
    const plugins = await addPlugins(createMockNuxt(true), [{ name: 'a' }, { name: 'b' }])
    expect(plugins.map(p => p.name)).toEqual(['a', 'b'])
  })

  it('should scope isomorphic plugins to the app environments', async () => {
    const [plugin] = await addPlugins(createMockNuxt(true), [{ name: 'a' }])
    expect(await appliesTo(plugin!, 'client')).toBe(true)
    expect(await appliesTo(plugin!, 'ssr')).toBe(true)
    expect(await appliesTo(plugin!, 'nitro')).toBe(false)
  })

  it('should scope single-environment plugins to their environment', async () => {
    const [clientOnly] = await addPlugins(createMockNuxt(true), [{ name: 'a' }], { server: false })
    expect(await appliesTo(clientOnly!, 'client')).toBe(true)
    expect(await appliesTo(clientOnly!, 'ssr')).toBe(false)

    const [serverOnly] = await addPlugins(createMockNuxt(true), [{ name: 'b' }], { client: false })
    expect(await appliesTo(serverOnly!, 'ssr')).toBe(true)
    expect(await appliesTo(serverOnly!, 'client')).toBe(false)
    expect(await appliesTo(serverOnly!, 'nitro')).toBe(false)
  })

  it('should respect a plugin own applyToEnvironment within the allowed environments', async () => {
    const plugins = await addPlugins(createMockNuxt(true), [
      { name: 'ssr-only', applyToEnvironment: env => env.name === 'ssr' },
      { name: 'replaced', applyToEnvironment: () => [{ name: 'replacement' }] },
    ])
    expect(await appliesTo(plugins[0]!, 'client')).toBe(false)
    expect(await appliesTo(plugins[0]!, 'ssr')).toBe(true)
    expect(await appliesTo(plugins[0]!, 'nitro')).toBe(false)
    expect(await appliesTo(plugins[1]!, 'client')).toEqual([{ name: 'replacement' }])
    expect(await appliesTo(plugins[1]!, 'nitro')).toBe(false)
  })

  it('should preserve plugin hooks, metadata and apply', async () => {
    const configureServer = vi.fn()
    const transform = vi.fn()
    const plugins = await addPlugins(createMockNuxt(true), [
      { name: 'a', apply: 'serve', configureServer, transform, devtools: { dock: 'yes' }, api: { hello: 'world' } } as VitePlugin,
    ])

    const plugin = plugins[0] as VitePlugin & { devtools?: unknown }
    expect(plugin.name).toBe('a')
    expect(plugin.apply).toBe('serve')
    expect(plugin.configureServer).toBe(configureServer)
    expect(plugin.transform).toBe(transform)
    expect(plugin.devtools).toEqual({ dock: 'yes' })
    expect(plugin.api).toEqual({ hello: 'world' })
  })

  it('should preserve the enforce of added plugins', async () => {
    const plugins = await addPlugins(createMockNuxt(false), [
      { name: 'normal' },
      { name: 'first', enforce: 'pre' },
      { name: 'last', enforce: 'post' },
    ])
    expect(plugins.map(p => [p.name, p.enforce])).toEqual([
      ['normal', undefined],
      ['first', 'pre'],
      ['last', 'post'],
    ])
  })

  it('should fall back to the default enforce for plugins that declare none', async () => {
    expect((await addPlugins(createMockNuxt(false), [{ name: 'a' }, { name: 'b', enforce: 'post' }], { prepend: true })).map(p => p.enforce)).toEqual(['pre', 'post'])
    expect((await addPlugins(createMockNuxt(false), [{ name: 'a' }, { name: 'b', enforce: 'pre' }], { server: false })).map(p => p.enforce)).toEqual(['post', 'pre'])
  })

  it('should prepend plugins when prepend: true', async () => {
    const nuxt = createMockNuxt(false)
    const config: ViteConfig = { plugins: [], environments: { client: {}, ssr: {} } }

    runWithNuxtContext(nuxt, () => {
      addVitePlugin([{ name: 'first' }], { prepend: true })
      addVitePlugin([{ name: 'second' }], { client: false, prepend: true })
    })
    await nuxt.callHook('vite:extend', { config } as any)

    expect((config.plugins as VitePlugin[]).map(p => p.name)).toEqual(['second', 'first'])
  })

  it('should append plugins when prepend is not set', async () => {
    const nuxt = createMockNuxt(false)
    const config: ViteConfig = { plugins: [], environments: { client: {}, ssr: {} } }

    runWithNuxtContext(nuxt, () => {
      addVitePlugin([{ name: 'first' }])
      addVitePlugin([{ name: 'second' }], { client: false })
    })
    await nuxt.callHook('vite:extend', { config } as any)

    expect((config.plugins as VitePlugin[]).map(p => p.name)).toEqual(['first', 'second'])
  })

  describe('without the environment API', () => {
    it('should add isomorphic plugins as-is', async () => {
      const nuxt = createMockNuxt(true)
      const config: ViteConfig = { plugins: [] }
      const plugin: VitePlugin = { name: 'a' }

      runWithNuxtContext(nuxt, () => addVitePlugin([plugin]))
      await nuxt.callHook('vite:extend', { config } as any)

      expect(config.plugins).toHaveLength(1)
      expect(config.plugins![0]).toBe(plugin)
    })

    it('should inject single-environment plugins per environment', async () => {
      const nuxt = createMockNuxt(true)
      const config: ViteConfig = { plugins: [] }
      const clientOnly: VitePlugin = { name: 'client-only' }

      runWithNuxtContext(nuxt, () => addVitePlugin([clientOnly], { server: false }))
      await nuxt.callHook('vite:extend', { config } as any)
      expect(config.plugins).toEqual([])

      const ssrConfig: NuxtViteConfig = { plugins: [] }
      await nuxt.callHook('vite:extendConfig', ssrConfig, { isServer: true, isClient: false })
      expect(ssrConfig.plugins).toEqual([])

      const clientConfig: NuxtViteConfig = { plugins: [] }
      await nuxt.callHook('vite:extendConfig', clientConfig, { isServer: false, isClient: true })
      expect(clientConfig.plugins).toEqual([clientOnly])
    })
  })

  it('should run server-level hooks and expose metadata on a real vite server', async () => {
    const nuxt = createMockNuxt(true)
    let mounted = false
    const plugins = await addPlugins(nuxt, [
      {
        name: 'hub',
        devtools: { dock: 'yes' },
        configureServer (server) {
          mounted = true
          server.middlewares.use('/__devtools/', (_req, res) => res.end('{"ok":true}'))
        },
      } as VitePlugin,
      { name: 'build-only', apply: 'build' },
    ])

    const server = await createServer({ logLevel: 'silent', configFile: false, server: { middlewareMode: true }, plugins })
    const names = server.config.plugins.map(p => p.name)
    const body = await new Promise((resolve) => {
      const res = { end: resolve, setHeader () {}, getHeader () {}, writeHead () {} }
      server.middlewares({ url: '/__devtools/', method: 'GET', headers: {} } as any, res as any, () => resolve('<not mounted>'))
    })
    await server.close()

    expect(mounted).toBe(true)
    expect(body).toBe('{"ok":true}')
    expect((server.config.plugins.find(p => p.name === 'hub') as any)?.devtools).toEqual({ dock: 'yes' })
    expect(names).not.toContain('build-only')
  })
})
