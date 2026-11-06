import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import { runWithNuxtContext } from '@nuxt/kit'
import { createServerBuild, setServerBuild, useServerBuild } from '@nuxt/kit/internal'
import { mergeConfig } from 'vite'
import type { EnvironmentOptions, Plugin, ResolvedConfig } from 'vite'

import { setupSSR } from '../src/ssr.ts'

function createNuxt (dev: boolean): Nuxt {
  return {
    options: {
      dev,
      rootDir: '/app',
      srcDir: '/app/app',
      buildDir: '/app/.nuxt',
      appDir: '/app/node_modules/nuxt/dist/app',
      vite: {},
      nitro: {},
      features: {},
      experimental: {},
      build: { templates: [] },
    },
    vfs: {},
    buildOutputs: {},
    hook: () => {},
    callHook: () => Promise.resolve(),
  } as unknown as Nuxt
}

function setup ({ prerender = false, dev = false } = {}) {
  const nuxt = createNuxt(dev)
  nuxt.options.nitro.static = prerender
  nuxt.serverBuild = createServerBuild(nuxt.options)
  setServerBuild({ runtime: { runtimeConfig: '/app/.nuxt/vite-server/runtime-config.mjs', handler: '/app/.output/server/index.mjs' } }, nuxt)

  const { entry } = runWithNuxtContext(nuxt, () => setupSSR(nuxt, '/app/.output'))
  const plugin = (nuxt.options.vite.plugins as Plugin[]).find(p => p.name === 'nuxt:vite-server:server-environment')!
  const configureEnvironment = (input?: EnvironmentOptions['build'], define?: EnvironmentOptions['define']) => {
    const config = { consumer: 'server', build: input, define } as unknown as EnvironmentOptions
    ;(plugin.configEnvironment as (name: string, config: EnvironmentOptions) => void).call(plugin, 'ssr', config)
    return config
  }
  const resolve = (config: EnvironmentOptions) => {
    (plugin.configResolved as ((config: ResolvedConfig) => void) | undefined)?.call(plugin, { environments: { ssr: config } } as unknown as ResolvedConfig)
  }
  const configure = (input?: EnvironmentOptions['build']) => {
    const config = configureEnvironment(input)
    resolve(config)
    return config
  }

  return { nuxt, entry, configure, configureEnvironment, resolve }
}

describe('the server environment', () => {
  it('builds the app entry and keeps the handler it emits', () => {
    const { nuxt, entry, configure } = setup()

    const config = configure()

    expect(config.build!.rolldownOptions!.input).toEqual({ index: entry })
    expect(useServerBuild(nuxt).runtime.handler).toBe('/app/.output/server/index.mjs')
  })

  it('keeps the handler when the environment is configured more than once', () => {
    const { nuxt, entry, configure } = setup()

    const config = configure(configure().build)

    expect(config.build!.rolldownOptions!.input).toEqual({ index: entry })
    expect(useServerBuild(nuxt).runtime.handler).toBe('/app/.output/server/index.mjs')
  })

  it('leaves a target its own input, and emits no handler of its own', () => {
    const { nuxt, configure } = setup()

    const config = configure({ rolldownOptions: { input: { worker: '/app/worker/index.ts' } } })

    expect(config.build!.rolldownOptions!.input).toEqual({ worker: '/app/worker/index.ts' })
    expect(useServerBuild(nuxt).runtime.handler).toBeUndefined()
  })

  it('leaves a target its own input when vite merges it with the app entry', () => {
    const { nuxt, configure } = setup()

    const config = configure({ rolldownOptions: { input: { server: '/app/node_modules/nuxt/dist/app/entry.js', index: '/app/worker/index.ts' } } })

    expect(config.build!.rolldownOptions!.input).toEqual({ index: '/app/worker/index.ts' })
    expect(useServerBuild(nuxt).runtime.handler).toBeUndefined()
  })

  it('leaves a target an entry it names `server`', () => {
    const { nuxt, configure } = setup()

    const config = configure({ rolldownOptions: { input: { server: '/app/worker/index.ts' } } })

    expect(config.build!.rolldownOptions!.input).toEqual({ server: '/app/worker/index.ts' })
    expect(useServerBuild(nuxt).runtime.handler).toBeUndefined()
  })

  it('replaces the app entry with the server entry', () => {
    const { nuxt, entry, configure } = setup()

    const config = configure({ rolldownOptions: { input: { server: '/app/node_modules/nuxt/dist/app/entry.js' } } })

    expect(config.build!.rolldownOptions!.input).toEqual({ index: entry })
    expect(useServerBuild(nuxt).runtime.handler).toBe('/app/.output/server/index.mjs')
  })

  it('emits no handler of its own when a target replaces the server entry later', () => {
    const { nuxt, configureEnvironment, resolve } = setup()

    const config = configureEnvironment({ rolldownOptions: { input: { server: '/app/node_modules/nuxt/dist/app/entry.js' } } })
    resolve(mergeConfig(config, { build: { rolldownOptions: { input: { index: 'virtual:ud:catch-all' } } } }))

    expect(useServerBuild(nuxt).runtime.handler).toBeUndefined()
  })

  it('refuses to prerender through a target that replaces the server entry later', () => {
    const { configureEnvironment, resolve } = setup({ prerender: true })

    const config = configureEnvironment({ rolldownOptions: { input: { server: '/app/node_modules/nuxt/dist/app/entry.js' } } })

    expect(() => resolve(mergeConfig(config, { build: { rolldownOptions: { input: { index: 'virtual:ud:catch-all' } } } }))).toThrow('cannot prerender through a deploy target')
  })

  it.each([false, true])('leaves browser globals to the runtime of a target (dev: %s)', (dev) => {
    const { configureEnvironment } = setup({ dev })
    const globals = { window: 'undefined', document: 'undefined', navigator: 'undefined', location: 'undefined', XMLHttpRequest: 'undefined' }
    const define = { ...globals, 'import.meta.server': 'true' }

    const target = configureEnvironment({ rolldownOptions: { input: { server: '/app/node_modules/nuxt/dist/app/entry.js', index: '/app/worker/index.ts' } } }, define)
    const app = configureEnvironment({ rolldownOptions: { input: { server: '/app/node_modules/nuxt/dist/app/entry.js' } } }, define)

    expect(Object.keys(target.define!).filter(key => key in globals)).toEqual([])
    expect(target.define).toHaveProperty(['import.meta.server'], 'true')
    expect(app.define).toMatchObject(globals)
  })
})
