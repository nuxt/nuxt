import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { isAbsolute, join, resolve } from 'pathe'
import { resolveModulePath } from 'exsolve'
import { rollup } from 'rollup'
import type { InputPluginOption } from 'rollup'
import { loadNuxt } from '@nuxt/kit'
import type { NuxtConfig } from '@nuxt/schema'
import { getRollupConfig } from 'nitropack/rollup'
import type { Nitro, NitroConfig } from 'nitropack/types'
import { RUNTIME_CONFIG_SCHEMA_ID } from '../src/runtime-config.ts'

const fixtureDir = resolve(import.meta.dirname, '../../../test/fixtures/minimal')

const serverReplacements = {
  '__VUE_OPTIONS_API__': 'true',
  '__VUE_PROD_DEVTOOLS__': 'false',
  '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false',
  'import.meta.test': 'false',
}

const getSchema = (nitro: Nitro) => JSON.parse((nitro.options.virtual[RUNTIME_CONFIG_SCHEMA_ID] as () => string)().split('\n')[0]!.replace(/^export default /, ''))

const hasBundledVuePlugin = (nitroConfig: NitroConfig) => (nitroConfig.rollupConfig!.plugins as Array<{ name?: string }>).some(plugin => plugin?.name === 'nuxt:bundled-vue')

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

async function isInlined (nitro: Nitro, id: string) {
  for (const matcher of nitro.options.externals.inline!) {
    if (typeof matcher === 'function' ? await matcher(id) : matcher instanceof RegExp ? matcher.test(id) : id.startsWith(matcher) || id.split('node_modules/').pop()!.startsWith(matcher)) {
      return true
    }
  }
  return false
}

describe('nitro config', () => {
  it('infers the prerenderer\'s runtime config schema from its own runtime config', async () => {
    await withNitro({ future: { compatibilityVersion: 5 }, runtimeConfig: { assets: { dir: 'public' } } }, async (nitro) => {
      const prerenderer = {
        options: {
          ...nitro.options,
          runtimeConfig: { ...nitro.options.runtimeConfig, assets: { dir: ['public', 'layers/shared/public'] } },
          virtual: { ...nitro.options.virtual },
        },
      } as unknown as Nitro
      await nitro.hooks.callHook('prerender:init', prerenderer)

      expect(getSchema(nitro).p.assets).toEqual({ p: { dir: 's' } })
      expect(getSchema(prerenderer).p.assets).toEqual({ p: { dir: { a: 's' } } })
    })
  }, 60_000)

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

  it('passes the server replacements to nitro as `replace`', async () => {
    await withNitro({}, (_nitro, nitroConfig) => {
      expect(nitroConfig.replace).toMatchObject(serverReplacements)
    })
  })

  it('passes the server replacements to the prerenderer', async () => {
    await withNitro({}, async (nitro) => {
      // nitro creates the prerenderer from a copy of this config
      const prerendererConfig: NitroConfig = { ...nitro.options._config }
      await nitro.hooks.callHook('prerender:config', prerendererConfig)
      expect(prerendererConfig.replace).toMatchObject(serverReplacements)
    })
  })

  it('inlines the nuxt renderer with either path separator', async () => {
    await withNitro({}, async (nitro) => {
      expect(await isInlined(nitro, '/project/node_modules/nuxt/dist/runtime/server/renderer/index.js')).toBe(true)
      expect(await isInlined(nitro, 'D:\\project\\node_modules\\nuxt\\dist\\runtime\\server\\renderer\\index.js')).toBe(true)
    })
  })

  it('resolves inlined vue to its esm-bundler builds in production', async () => {
    await withNitro({ dev: false }, (_nitro, nitroConfig) => {
      expect(hasBundledVuePlugin(nitroConfig)).toBe(true)
    })
    await withNitro({ dev: false, vue: { runtimeCompiler: true } }, (_nitro, nitroConfig) => {
      expect(hasBundledVuePlugin(nitroConfig)).toBe(false)
    })
  })

  it('bundles vue when a vue entry is imported by its resolved commonjs path', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'nuxt-vue-package-'))
    await withNitro({ dev: false, nitro: { output: { dir: outputDir } } }, async (nitro) => {
      const shared = resolveModulePath('@vue/shared', { from: nitro.options.nodeModulesDirs, conditions: ['node', 'production'] })
      expect(shared).toMatch(/shared\.cjs\.prod\.js$/)

      await mkdir(nitro.options.output.serverDir, { recursive: true })
      const config = getRollupConfig(nitro)
      const bundle = await rollup({
        ...config,
        input: 'entry',
        plugins: [
          {
            name: 'entry',
            resolveId: id => id === 'entry' ? id : undefined,
            load: id => id === 'entry' ? `import { isArray } from ${JSON.stringify(shared)}\nexport default isArray` : undefined,
          },
          ...config.plugins as InputPluginOption[],
        ],
      })
      const { output } = await bundle.generate(config.output)
      await bundle.close()

      const modules = output.flatMap(chunk => chunk.type === 'chunk' ? Object.keys(chunk.modules) : [])
      expect(modules).toContain(shared.replace(/shared\.cjs\.prod\.js$/, 'shared.esm-bundler.js'))
      expect(modules).not.toContain(shared)
    }).finally(() => rm(outputDir, { recursive: true, force: true }))
  }, 60_000)

  it('does not inline the dependencies of an absolute `build.transpile` directory', async () => {
    const moduleDir = resolve(fixtureDir, '../workspace-module')
    await withNitro({ dev: false, build: { transpile: [moduleDir, '@nuxt/image'] } }, async (nitro) => {
      expect(nitro.options.externals.inline).toContain('@nuxt/image')
      expect(await isInlined(nitro, `${moduleDir}/src/runtime/server/routes/_ipx.ts`)).toBe(true)
      expect(await isInlined(nitro, `${moduleDir}/node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/lib/index.js`)).toBe(false)
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
    await withNitro({}, (_nitro, nitroConfig) => {
      const errorChannel = nitroConfig.virtual!['#internal/nuxt/error-channel'] as () => string
      expect(errorChannel()).toBe('export {}')
    })
  })

  it('excludes sources from server sourcemaps for `nosource`', async () => {
    await withNitro({ sourcemap: { server: 'nosource' } }, (_nitro, nitroConfig) => {
      expect(nitroConfig.sourceMap).toBe(true)
      expect(nitroConfig.rollupConfig!.output!.sourcemapExcludeSources).toBe(true)
    })
  })

  it.for([true, 'hidden'] as const)('leaves `sourcemapExcludeSources` unset for `%s`', async (server) => {
    await withNitro({ sourcemap: { server } }, (_nitro, nitroConfig) => {
      expect(nitroConfig.rollupConfig!.output).not.toHaveProperty('sourcemapExcludeSources')
    })
  })
})
