import type { Nuxt, RsbuildConfig, RsbuildPlugin } from '@nuxt/schema'
import { createHooks } from 'hookable'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as context from '../src/context.ts'
import { addBuildPlugin, addRsbuildPlugin, extendRsbuildConfig } from '../src/build.ts'

function mockNuxt (options: { dev?: boolean } = {}) {
  const nuxt = {
    hooks: createHooks(),
    options: {
      dev: options.dev ?? false,
      build: true,
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

    const config: RsbuildConfig = { environments: { client: {}, ssr: {} } }
    await nuxt.callHook('rsbuild:config', config)
    expect((config.plugins as RsbuildPlugin[]).map(p => p.name)).toEqual(['first', 'shared'])
    expect((config.environments!.client!.plugins as RsbuildPlugin[]).map(p => p.name)).toEqual(['client'])
    expect((config.environments!.ssr!.plugins as RsbuildPlugin[]).map(p => p.name)).toEqual(['server'])
  })

  it('does not add an environment for a plugin scoped to an environment that does not exist', async () => {
    const nuxt = mockNuxt()
    addRsbuildPlugin(plugin('server'), { client: false })

    const config: RsbuildConfig = { environments: { client: {} } }
    await nuxt.callHook('rsbuild:config', config)
    expect(config.environments).toEqual({ client: {} })
  })

  it('prefers Rspack plugins over Rsbuild plugins', async () => {
    const nuxt = mockNuxt()
    const rspackPlugin = { apply () {} }
    addBuildPlugin({ rsbuild: () => plugin('both'), rspack: () => rspackPlugin })
    addBuildPlugin({ rsbuild: () => plugin('rsbuild') })

    const rsbuildConfig: RsbuildConfig = {}
    await nuxt.callHook('rsbuild:config', rsbuildConfig)
    const rspackConfigs = [{ name: 'client', plugins: [] }, { name: 'ssr', plugins: [] }]
    await nuxt.callHook('rspack:config', rspackConfigs as any)

    expect((rsbuildConfig.plugins as RsbuildPlugin[]).map(p => p.name)).toEqual(['rsbuild'])
    expect(rspackConfigs.map(c => c.plugins.length)).toEqual([1, 1])
  })
})
