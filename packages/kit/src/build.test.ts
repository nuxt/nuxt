import type { Nuxt } from '@nuxt/schema'
import type { NastiConfig, NastiPlugin } from '@nasti-toolchain/nasti'
import { describe, expect, it, vi } from 'vitest'
import { addBuildPlugin, addNastiPlugin, extendNastiConfig } from './build.ts'
import { runWithNuxtContext } from './context.ts'

type HookHandler = (payload: any) => any

function createMockNuxt (options: { dev?: boolean, build?: boolean } = {}) {
  const hooks: Record<string, HookHandler[]> = {}
  const nuxt = {
    options: {
      dev: false,
      build: true,
      ...options,
    },
    hook: vi.fn((name: string, handler: HookHandler) => {
      const handlers = (hooks[name] ||= [])
      handlers.push(handler)

      return () => {
        hooks[name] = handlers.filter(h => h !== handler)
      }
    }),
  } as unknown as Nuxt

  return { hooks, nuxt }
}

async function callNastiExtend (
  hooks: Record<string, HookHandler[]>,
  config: NastiConfig = {} as NastiConfig,
) {
  for (const handler of hooks['nasti:extend'] || []) {
    await handler({ config })
  }
  return config
}

describe('nasti build kit helpers', () => {
  it('extends the shared Nasti config once', async () => {
    const { hooks, nuxt } = createMockNuxt()
    const fn = vi.fn((config: NastiConfig) => {
      config.mode = 'development'
    })

    const unregister = runWithNuxtContext(nuxt, () => extendNastiConfig(fn))

    expect(unregister).toBeTypeOf('function')
    expect(nuxt.hook).toHaveBeenCalledWith(
      'nasti:extend',
      expect.any(Function),
    )

    const config = await callNastiExtend(hooks)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(config)
    expect(config.mode).toBe('development')
  })

  it('respects dev and build registration options', () => {
    const devOnly = createMockNuxt({ dev: true, build: false })
    const buildOnly = createMockNuxt({ dev: false, build: true })
    const fn = vi.fn()

    runWithNuxtContext(devOnly.nuxt, () =>
      extendNastiConfig(fn, { dev: false }),
    )
    runWithNuxtContext(buildOnly.nuxt, () =>
      extendNastiConfig(fn, { build: false }),
    )

    expect(devOnly.nuxt.hook).not.toHaveBeenCalled()
    expect(buildOnly.nuxt.hook).not.toHaveBeenCalled()
  })

  it('adds Nasti plugins from an async factory and preserves prepend order', async () => {
    const { hooks, nuxt } = createMockNuxt()
    const existing = { name: 'existing' } as NastiPlugin
    const pluginA = { name: 'plugin-a' } as NastiPlugin
    const pluginB = { name: 'plugin-b' } as NastiPlugin
    const factory = vi.fn(() => Promise.resolve([pluginA, pluginB]))

    runWithNuxtContext(nuxt, () => addNastiPlugin(factory, { prepend: true }))

    const config = await callNastiExtend(hooks, {
      plugins: [existing],
    } as NastiConfig)

    expect(factory).toHaveBeenCalledTimes(1)
    expect(config.plugins?.map(plugin => plugin.name)).toEqual([
      'plugin-a',
      'plugin-b',
      'existing',
    ])
  })

  it('scopes Nasti plugins to the requested environment', async () => {
    const { hooks, nuxt } = createMockNuxt()
    const userApply = vi.fn(
      (environment: { name: string }) => environment.name === 'client',
    )
    const plugin = {
      name: 'client-only',
      applyToEnvironment: userApply,
    } as NastiPlugin

    runWithNuxtContext(nuxt, () => addNastiPlugin(plugin, { server: false }))

    const config = await callNastiExtend(hooks)
    const scopedPlugin = config.plugins?.[0]

    expect(scopedPlugin?.applyToEnvironment?.({ name: 'client' } as any)).toBe(
      true,
    )
    expect(scopedPlugin?.applyToEnvironment?.({ name: 'ssr' } as any)).toBe(
      false,
    )
    expect(userApply).toHaveBeenCalledOnce()

    const ssrOnly = createMockNuxt()
    runWithNuxtContext(ssrOnly.nuxt, () =>
      addNastiPlugin({ name: 'ssr-only' } as NastiPlugin, { client: false }),
    )

    const ssrConfig = await callNastiExtend(ssrOnly.hooks)
    const ssrPlugin = ssrConfig.plugins?.[0]

    expect(ssrPlugin?.applyToEnvironment?.({ name: 'client' } as any)).toBe(
      false,
    )
    expect(ssrPlugin?.applyToEnvironment?.({ name: 'ssr' } as any)).toBe(true)
  })

  it('adds the Nasti branch from addBuildPlugin', async () => {
    const { hooks, nuxt } = createMockNuxt()
    const factory = vi.fn(() =>
      Promise.resolve({ name: 'build-plugin' } as NastiPlugin),
    )

    runWithNuxtContext(nuxt, () => addBuildPlugin({ nasti: factory }))

    const config = await callNastiExtend(hooks)

    expect(factory).toHaveBeenCalledTimes(1)
    expect(config.plugins?.map(plugin => plugin.name)).toEqual([
      'build-plugin',
    ])
  })
})
