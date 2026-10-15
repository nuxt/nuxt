import type { Nuxt, RsbuildConfig, RsbuildPlugin } from '@nuxt/schema'
import { createHooks } from 'hookable'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as context from './context.ts'
import { addBuildPlugin, addRsbuildPlugin, extendRsbuildConfig } from './build.ts'

function mockNuxt (options: { dev?: boolean, builder?: string } = {}) {
  const nuxt = {
    hooks: createHooks(),
    options: {
      dev: options.dev ?? false,
      build: true,
      builder: options.builder ?? '@nuxt/rsbuild-builder',
    },
  } as unknown as Nuxt
  nuxt.hook = nuxt.hooks.hook.bind(nuxt.hooks)
  nuxt.callHook = nuxt.hooks.callHook.bind(nuxt.hooks)
  vi.spyOn(context, 'useNuxt').mockReturnValue(nuxt)
  return nuxt
}

const plugin = (name: string): RsbuildPlugin => ({ name, setup () {} })

describe('rsbuild build utilities', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('extends the Rsbuild config', async () => {
    const nuxt = mockNuxt()
    extendRsbuildConfig((config) => {
      config.mode = 'none'
    })
    extendRsbuildConfig(() => {
      throw new Error('should not be called in production')
    }, { build: false })

    const config: RsbuildConfig = {}
    await nuxt.callHook('rsbuild:config', config)
    expect(config.mode).toBe('none')
  })

  it('adds Rsbuild plugins globally or to a single environment', async () => {
    const nuxt = mockNuxt()
    addRsbuildPlugin(plugin('shared'))
    addRsbuildPlugin(() => [plugin('first')], { prepend: true })
    addRsbuildPlugin(plugin('client'), { server: false })
    addRsbuildPlugin(plugin('server'), { client: false })
    addRsbuildPlugin(plugin('nowhere'), { client: false, server: false })

    const config: RsbuildConfig = { environments: { client: {}, server: {} } }
    await nuxt.callHook('rsbuild:config', config)
    expect((config.plugins as RsbuildPlugin[]).map(p => p.name)).toEqual(['first', 'shared'])
    expect((config.environments!.client!.plugins as RsbuildPlugin[]).map(p => p.name)).toEqual(['client'])
    expect((config.environments!.server!.plugins as RsbuildPlugin[]).map(p => p.name)).toEqual(['server'])
  })

  it('prefers Rsbuild plugins over Rspack plugins when using the Rsbuild builder', async () => {
    const nuxt = mockNuxt()
    const rspackPlugin = { apply () {} }
    addBuildPlugin({ rsbuild: () => plugin('rsbuild'), rspack: () => rspackPlugin })
    addBuildPlugin({ rspack: () => rspackPlugin })

    const rsbuildConfig: RsbuildConfig = {}
    await nuxt.callHook('rsbuild:config', rsbuildConfig)
    const rspackConfigs = [{ name: 'client', plugins: [] }, { name: 'server', plugins: [] }]
    await nuxt.callHook('rspack:config', rspackConfigs as any)

    expect((rsbuildConfig.plugins as RsbuildPlugin[]).map(p => p.name)).toEqual(['rsbuild'])
    // the plugin without an Rsbuild variant is applied to both Rspack configurations
    expect(rspackConfigs.map(c => c.plugins.length)).toEqual([1, 1])
  })

  it('applies the Rspack plugin of unplugin instances when using the Rsbuild builder', async () => {
    const nuxt = mockNuxt()
    const rspackPlugin = { apply () {} }
    // the shape of an unplugin instance, whose Rsbuild plugin wraps its Rspack plugin
    addBuildPlugin({ raw: () => ({}), rsbuild: () => plugin('unplugin'), rspack: () => rspackPlugin } as Parameters<typeof addBuildPlugin>[0])

    const rsbuildConfig: RsbuildConfig = {}
    await nuxt.callHook('rsbuild:config', rsbuildConfig)
    const rspackConfigs = [{ name: 'client', plugins: [] }, { name: 'server', plugins: [] }]
    await nuxt.callHook('rspack:config', rspackConfigs as any)

    expect(rsbuildConfig.plugins).toBeUndefined()
    expect(rspackConfigs.map(c => c.plugins.length)).toEqual([1, 1])
  })

  it('applies Rspack plugins when using the Rspack builder', async () => {
    const nuxt = mockNuxt({ builder: '@nuxt/rspack-builder' })
    const rspackPlugin = { apply () {} }
    addBuildPlugin({ rsbuild: () => plugin('rsbuild'), rspack: () => rspackPlugin })

    const rspackConfigs = [{ name: 'client', plugins: [] }, { name: 'server', plugins: [] }]
    await nuxt.callHook('rspack:config', rspackConfigs as any)
    expect(rspackConfigs.map(c => c.plugins.length)).toEqual([1, 1])
  })
})
