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

async function resolveClientPlugins (nuxt: Nuxt, plugins: VitePlugin[], environment: Record<string, unknown> = {
  name: 'client',
  getTopLevelConfig: () => ({
    command: nuxt.options.dev ? 'serve' : 'build',
    mode: nuxt.options.dev ? 'development' : 'production',
  }),
}) {
  const config: ViteConfig = { plugins: [], environments: { client: {}, ssr: {} } }
  runWithNuxtContext(nuxt, () => addVitePlugin(plugins))
  await nuxt.callHook('vite:extend', { config } as any)

  const wrapper = config.plugins![0] as VitePlugin
  const applied = await wrapper.applyToEnvironment!(environment as any)
  return (Array.isArray(applied) ? applied : []).map(p => (p as VitePlugin).name)
}

async function resolveWrappers (nuxt: Nuxt, plugins: VitePlugin[], options?: Parameters<typeof addVitePlugin>[1]) {
  const config: ViteConfig = { plugins: [], environments: { client: {}, ssr: {} } }
  runWithNuxtContext(nuxt, () => addVitePlugin(plugins, options))
  await nuxt.callHook('vite:extend', { config } as any)

  const environment = { name: 'client', getTopLevelConfig: () => ({ command: 'build', mode: 'production' }) }
  return Promise.all((config.plugins as VitePlugin[]).map(async wrapper => ({
    enforce: wrapper.enforce,
    plugins: ((await wrapper.applyToEnvironment!(environment as any)) as VitePlugin[]).map(p => p.name),
  })))
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

  it('should infer the command when the environment predates `getTopLevelConfig`', async () => {
    const nuxt = createMockNuxt(true)
    const names = await resolveClientPlugins(nuxt, [
      { name: 'always' },
      { name: 'serve-only', apply: 'serve' },
      { name: 'build-only', apply: 'build' },
    ], { name: 'client' })
    expect(names).toEqual(['always', 'serve-only'])
  })

  it('should honour the enforce of wrapped plugins', async () => {
    const nuxt = createMockNuxt(false)
    const wrappers = await resolveWrappers(nuxt, [
      { name: 'normal' },
      { name: 'first', enforce: 'pre' },
      { name: 'last', enforce: 'post' },
      { name: 'also-first', enforce: 'pre' },
    ])
    expect(wrappers).toEqual([
      { enforce: undefined, plugins: ['normal'] },
      { enforce: 'pre', plugins: ['first', 'also-first'] },
      { enforce: 'post', plugins: ['last'] },
    ])
  })

  it('should fall back to the default enforce for plugins that declare none', async () => {
    // With prepend: true, wrappers are unshifted so they appear in reverse order
    // (last enforce group first). Vite sorts by enforce at the top level anyway.
    expect(await resolveWrappers(createMockNuxt(false), [{ name: 'a' }, { name: 'b', enforce: 'post' }], { prepend: true })).toEqual([
      { enforce: 'post', plugins: ['b'] },
      { enforce: 'pre', plugins: ['a'] },
    ])
    expect(await resolveWrappers(createMockNuxt(false), [{ name: 'a' }, { name: 'b', enforce: 'pre' }], { server: false })).toEqual([
      { enforce: 'post', plugins: ['a'] },
      { enforce: 'pre', plugins: ['b'] },
    ])
  })

  it('should resolve nested and async replacement plugins', async () => {
    const nuxt = createMockNuxt(false)
    const names = await resolveClientPlugins(nuxt, [
      { name: 'deep', applyToEnvironment: () => [[{ name: 'nested' }], Promise.resolve({ name: 'async' })] as any },
      { name: 'empty', applyToEnvironment: () => [null, undefined, false] as any },
    ])
    expect(names).toEqual(['nested', 'async'])
  })

  it('should prepend wrapper plugins when prepend: true', async () => {
    const nuxt = createMockNuxt(false)
    const config: ViteConfig = { plugins: [], environments: { client: {}, ssr: {} } }

    runWithNuxtContext(nuxt, () => {
      addVitePlugin([{ name: 'first' }], { prepend: true })
      addVitePlugin([{ name: 'second' }], { client: false, prepend: true })
    })
    await nuxt.callHook('vite:extend', { config } as any)

    const wrapperNames = (config.plugins as VitePlugin[]).map(p => p.name)
    const firstIndex = wrapperNames.findIndex(n => n === 'first:wrapper')
    const secondIndex = wrapperNames.findIndex(n => n === 'second:wrapper')

    expect(firstIndex).toBeGreaterThan(-1)
    expect(secondIndex).toBeGreaterThan(-1)
    expect(secondIndex).toBeLessThan(firstIndex)
  })

  it('should append wrapper plugins when prepend is not set', async () => {
    const nuxt = createMockNuxt(false)
    const config: ViteConfig = { plugins: [], environments: { client: {}, ssr: {} } }

    runWithNuxtContext(nuxt, () => {
      addVitePlugin([{ name: 'first' }])
      addVitePlugin([{ name: 'second' }], { client: false })
    })
    await nuxt.callHook('vite:extend', { config } as any)

    const wrapperNames = (config.plugins as VitePlugin[]).map(p => p.name)
    const firstIndex = wrapperNames.findIndex(n => n === 'first:wrapper')
    const secondIndex = wrapperNames.findIndex(n => n === 'second:wrapper')

    expect(firstIndex).toBeGreaterThan(-1)
    expect(secondIndex).toBeGreaterThan(-1)
    expect(secondIndex).toBeGreaterThan(firstIndex)
  })
})
