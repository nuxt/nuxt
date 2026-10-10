import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isAbsolute, resolve } from 'pathe'
import { loadNuxt } from '@nuxt/kit'
import type { NuxtConfig } from '@nuxt/schema'
import type { Nitro, NitroConfig } from 'nitro/types'

const fixtureDir = resolve(import.meta.dirname, '../../../test/fixtures/minimal')

const serverReplacements = {
  '__VUE_PROD_DEVTOOLS__': 'false',
  'import.meta.test': 'false',
}

async function withNitro<T> (overrides: NuxtConfig, fn: (nitro: Nitro, nitroConfig: NitroConfig) => T | Promise<T>) {
  let nitroConfig: NitroConfig | undefined
  let nitro: Nitro | undefined
  const nuxt = await loadNuxt({
    cwd: fixtureDir,
    ready: true,
    overrides: {
      ...overrides,
      hooks: {
        'nitro:config' (config) {
          nitroConfig = config
        },
        'nitro:init' (_nitro) {
          nitro = _nitro
        },
      },
    },
  })
  try {
    return await fn(nitro!, nitroConfig!)
  } finally {
    await nuxt.close()
  }
}

describe('nitro config', () => {
  it('passes the server replacements to nitro as `replace` without nitroViteEnvironment', async () => {
    await withNitro({ experimental: { nitroViteEnvironment: false } }, (_nitro, nitroConfig) => {
      expect(nitroConfig.replace).toMatchObject(serverReplacements)
    })
  })

  it('leaves the server replacements to the vite `define` with nitroViteEnvironment', async () => {
    await withNitro({ experimental: { nitroViteEnvironment: true } }, (_nitro, nitroConfig) => {
      expect(nitroConfig.replace).not.toHaveProperty('__VUE_PROD_DEVTOOLS__')
    })
  })

  it.for([true, false])('passes the server replacements to the prerenderer when nitroViteEnvironment is %s', async (nitroViteEnvironment) => {
    await withNitro({ experimental: { nitroViteEnvironment } }, async (nitro) => {
      // nitro creates the prerenderer from a copy of this config
      const prerendererConfig: NitroConfig = { ...nitro.options._config }
      await nitro.hooks.callHook('prerender:config', prerendererConfig)
      expect(prerendererConfig.replace).toMatchObject(serverReplacements)
    })
  })

  it('does not inline the dependencies of an absolute `build.transpile` directory', async () => {
    const moduleDir = resolve(fixtureDir, '../workspace-module')
    await withNitro({ dev: false, build: { transpile: [moduleDir, '@nuxt/image'] } }, (nitro) => {
      const noExternals = nitro.options.noExternals as Array<string | RegExp>
      const isNoExternal = (id: string) => noExternals.some(entry => typeof entry === 'string' ? id.includes(entry) : entry.test(id))
      expect(noExternals).toContain('@nuxt/image')
      expect(isNoExternal(`${moduleDir}/src/runtime/server/routes/_ipx.ts`)).toBe(true)
      expect(isNoExternal(`${moduleDir}/node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/lib/index.js`)).toBe(false)
    })
  })

  it('aliases `@vue/devtools-api` to a resolved path', async () => {
    await withNitro({}, (_nitro, nitroConfig) => {
      const alias = nitroConfig.alias!['@vue/devtools-api']!
      expect(isAbsolute(alias)).toBe(true)
      expect(existsSync(alias)).toBe(true)
      expect(alias).toContain('vue-devtools-stub')
    })
  })

  it('does not include the dev error channel in production builds', async () => {
    await withNitro({ dev: false }, (_nitro, nitroConfig) => {
      const errorChannel = nitroConfig.virtual!['#internal/nuxt/error-channel'] as () => string
      expect(errorChannel()).toBe('export {}')
    })
  })
})
