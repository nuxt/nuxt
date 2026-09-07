import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import { runWithNuxtContext } from '@nuxt/kit'
import { createServerBuild, setServerBuild } from '@nuxt/kit/internal'
import type { EnvironmentOptions, Plugin } from 'vite'

import { setupSSR } from '../src/ssr.ts'

function createNuxt (): Nuxt {
  return {
    options: {
      dev: false,
      rootDir: '/app',
      srcDir: '/app/app',
      buildDir: '/app/.nuxt',
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

function setup () {
  const nuxt = createNuxt()
  nuxt.serverBuild = createServerBuild(nuxt.options)
  setServerBuild({ runtime: { runtimeConfig: '/app/.nuxt/vite-server/runtime-config.mjs' } }, nuxt)

  const { entry } = runWithNuxtContext(nuxt, () => setupSSR(nuxt, '/app/.output'))
  const plugin = (nuxt.options.vite.plugins as Plugin[]).find(p => p.name === 'nuxt:vite-server:server-environment')!
  const configure = (input?: EnvironmentOptions['build']) => {
    const config = { consumer: 'server', build: input } as unknown as EnvironmentOptions
    ;(plugin.configEnvironment as (name: string, config: EnvironmentOptions) => void).call(plugin, 'ssr', config)
    return config
  }

  return { nuxt, entry, configure }
}

describe('the server environment', () => {
  it('builds the app entry', () => {
    const { entry, configure } = setup()

    const config = configure()

    expect(config.build!.rolldownOptions!.input).toEqual({ index: entry })
  })

  it('leaves a target its own input', () => {
    const { configure } = setup()

    const config = configure({ rolldownOptions: { input: { worker: '/app/worker/index.ts' } } })

    expect(config.build!.rolldownOptions!.input).toEqual({ worker: '/app/worker/index.ts' })
  })
})
