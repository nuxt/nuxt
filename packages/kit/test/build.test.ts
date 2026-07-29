import { createHooks } from 'hookable'
import type { Nuxt } from 'nuxt/schema'
import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import { describe, expect, it } from 'vitest'

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
      experimental: { nitroViteEnvironment: true },
      vite: { mode: dev ? 'development' : 'production' },
    },
  } as unknown as Nuxt
}

async function resolveClientPlugins (nuxt: Nuxt, plugins: VitePlugin[]) {
  const config: ViteConfig = { plugins: [], environments: { client: {}, ssr: {} } }
  runWithNuxtContext(nuxt, () => addVitePlugin(plugins))
  await nuxt.callHook('vite:extend', { config } as any)

  const wrapper = config.plugins![0] as VitePlugin
  const applied = await wrapper.applyToEnvironment!({ name: 'client' } as any)
  return (Array.isArray(applied) ? applied : []).map(p => (p as VitePlugin).name)
}

describe('addVitePlugin', () => {
  it('should filter nested dev-only plugins out of production builds', async () => {
    const nuxt = createMockNuxt(false)
    const names = await resolveClientPlugins(nuxt, [
      { name: 'always' },
      { name: 'serve-only', apply: 'serve' },
      { name: 'build-only', apply: 'build' },
      { name: 'fn-apply', apply: (_config, env) => env.command === 'build' },
    ])
    expect(names).toEqual(['always', 'build-only', 'fn-apply'])
  })

  it('should filter nested build-only plugins out of dev', async () => {
    const nuxt = createMockNuxt(true)
    const names = await resolveClientPlugins(nuxt, [
      { name: 'always' },
      { name: 'serve-only', apply: 'serve' },
      { name: 'build-only', apply: 'build' },
    ])
    expect(names).toEqual(['always', 'serve-only'])
  })

  it('should respect a nested plugin own applyToEnvironment', async () => {
    const nuxt = createMockNuxt(false)
    const names = await resolveClientPlugins(nuxt, [
      { name: 'ssr-only', applyToEnvironment: env => env.name === 'ssr' },
      { name: 'client-only', applyToEnvironment: env => env.name === 'client' },
      { name: 'replaced', applyToEnvironment: () => [{ name: 'replacement' }] },
    ])
    expect(names).toEqual(['client-only', 'replacement'])
  })
})
