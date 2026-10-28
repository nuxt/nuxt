import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isAbsolute, resolve } from 'pathe'
import { loadNuxt } from '@nuxt/kit'
import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import type { Nitro, NitroConfig } from 'nitro/types'

const fixtureDir = resolve(import.meta.dirname, '../../../test/fixtures/minimal')

const serverReplacements = {
  'process.env.NODE_ENV': '"production"',
  '__VUE_OPTIONS_API__': 'false',
  '__VUE_PROD_DEVTOOLS__': 'false',
  '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false',
  'import.meta.test': 'false',
}

const hasBundledVuePlugin = (nitroConfig: NitroConfig) => (nitroConfig.rollupConfig!.plugins as Array<{ name?: string }>).some(plugin => plugin?.name === 'nuxt:bundled-vue')

async function withNitro<T> (overrides: NuxtConfig, fn: (nitro: Nitro, nitroConfig: NitroConfig, nuxt: Nuxt) => T | Promise<T>) {
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
    return await fn(nitro!, nitroConfig!, nuxt)
  } finally {
    await nuxt.close()
  }
}

describe('nitro config', () => {
  it('emits valid single-segment URLPatterns for noScripts wildcard rules', async () => {
    await withNitro({ routeRules: { '/foo/*': { noScripts: true }, '/scripted/*': { ssr: true } } }, async (_nitro, nitroConfig) => {
      const rendererConfig = nitroConfig.virtual!['nuxt/internal/renderer-config'] as () => Promise<string>
      const code = await rendererConfig()
      const patterns: string[] = JSON.parse(/^export const NUXT_NO_SCRIPTS_PATTERNS = (.+)$/m.exec(code)![1]!)

      expect(patterns).toEqual(['/foo/([^\\/]*)'])
      const pattern = new URLPattern({ pathname: patterns[0] })
      expect(pattern.test('https://example.com/foo/bar')).toBe(true)
      expect(pattern.test('https://example.com/foo/bar/baz')).toBe(false)
      expect(pattern.test('https://example.com/scripted/bar')).toBe(false)
    })
  }, 60_000)

  it('emits noScripts patterns for the rules that apply to a GET request', async () => {
    const routeRules = {
      '/foo': { noScripts: true },
      'GET /foo': { noScripts: false },
      'GET /bar': { noScripts: true },
      'POST /baz': { noScripts: true },
    }
    await withNitro({ routeRules }, async (_nitro, nitroConfig) => {
      const rendererConfig = nitroConfig.virtual!['nuxt/internal/renderer-config'] as () => Promise<string>
      const code = await rendererConfig()
      expect(JSON.parse(/^export const NUXT_NO_SCRIPTS_PATTERNS = (.+)$/m.exec(code)![1]!)).toEqual(['/bar'])
    })
  }, 60_000)

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

  it('bundles the esm-bundler builds of vue in production', async () => {
    await withNitro({ dev: false }, (_nitro, nitroConfig) => {
      expect(hasBundledVuePlugin(nitroConfig)).toBe(true)
    })
    await withNitro({ dev: false, vue: { runtimeCompiler: true } }, (_nitro, nitroConfig) => {
      expect(hasBundledVuePlugin(nitroConfig)).toBe(false)
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

  it('excludes sources from server sourcemaps for `nosource`', async () => {
    await withNitro({ sourcemap: { server: 'nosource' } }, (_nitro, nitroConfig) => {
      expect(nitroConfig.rollupConfig!.output!.sourcemapExcludeSources).toBe(true)
    })
  })

  it.for([true, 'hidden'] as const)('leaves `sourcemapExcludeSources` unset for `%s`', async (server) => {
    await withNitro({ sourcemap: { server } }, (_nitro, nitroConfig) => {
      expect(nitroConfig.rollupConfig!.output).not.toHaveProperty('sourcemapExcludeSources')
    })
  })

  it.for([true, false])('registers the server auto-imports plugin once when nitroViteEnvironment is %s', async (nitroViteEnvironment) => {
    await withNitro({ experimental: { nitroViteEnvironment } }, (_nitro, nitroConfig, nuxt) => {
      const isAutoImportsPlugin = (plugin: unknown) => (plugin as { name?: string } | null)?.name === 'nuxt:server-auto-imports'
      expect([nitroConfig.rollupConfig!.plugins].flat().filter(isAutoImportsPlugin)).toHaveLength(1)
      expect(nuxt.options.vite.plugins?.flat().filter(isAutoImportsPlugin) ?? []).toHaveLength(0)
    })
  })

  it.for([true, false])('registers server import protection once, ahead of other resolvers, when nitroViteEnvironment is %s', async (nitroViteEnvironment) => {
    await withNitro({ experimental: { nitroViteEnvironment } }, (_nitro, nitroConfig, nuxt) => {
      const isImpound = (plugin: unknown) => (plugin as { name?: string } | null)?.name === 'impound'
      const plugins = [nitroConfig.rollupConfig!.plugins].flat().filter(isImpound) as Array<{ resolveId?: { order?: string } }>
      expect(plugins).toHaveLength(1)
      expect(plugins[0]!.resolveId?.order).toBe('pre')
      expect(nuxt.options.vite.plugins?.flat().filter(isImpound) ?? []).toHaveLength(0)
    })
  })
})
