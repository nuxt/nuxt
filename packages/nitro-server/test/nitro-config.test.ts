import { existsSync } from 'node:fs'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { isAbsolute, join, resolve } from 'pathe'
import { directoryToURL, isNuxtMajorVersion, loadNuxt } from '@nuxt/kit'
import { createNitro } from 'nitro/builder'
import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import type { Nitro, NitroConfig } from 'nitro/types'
import { resolveModulePath } from 'exsolve'
import { nitroBuildDiagnostics } from '../src/diagnostics.ts'
import { RUNTIME_CONFIG_SCHEMA_ID } from '../src/runtime-config.ts'

const fixtureDir = resolve(import.meta.dirname, '../../../test/fixtures/minimal')

const serverReplacements = (nuxt: Nuxt) => ({
  'process.env.NODE_ENV': '"production"',
  '__VUE_OPTIONS_API__': String(!!nuxt.options.vue.optionsApi),
  '__VUE_PROD_DEVTOOLS__': 'false',
  '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false',
  'import.meta.test': 'false',
})

const getSchema = (nitro: Nitro) => JSON.parse((nitro.options.virtual[RUNTIME_CONFIG_SCHEMA_ID] as () => string)().replace(/^export default /, ''))

const asNuxtMajor = (major: number) => (_options: unknown, nuxt: Nuxt) => {
  nuxt._version = `${major}.0.0`
}

const findH3RuntimePlugin = (nitroConfig: NitroConfig) => ([nitroConfig.rollupConfig!.plugins].flat() as Array<{ name?: string, resolveId: { handler: (id: string) => string | undefined } }>)
  .find(plugin => plugin?.name === 'nuxt:nitro:h3-v1-runtime')

async function findViteH3RuntimePlugin (nuxt: Nuxt) {
  const config = { environments: { ssr: {}, client: {} }, plugins: [] }
  await nuxt.callHook('vite:extend', { nuxt, config } as any)
  return (config.plugins.flat() as Array<{ name?: string, applyToEnvironment: (environment: { name: string }) => boolean, resolveId: (id: string) => string | undefined }>)
    .find(plugin => plugin?.name === 'nuxt:nitro:h3-v1-runtime')
}

const hasBundledVuePlugin = (nitroConfig: NitroConfig) => (nitroConfig.rollupConfig!.plugins as Array<{ name?: string }>).some(plugin => plugin?.name === 'nuxt:bundled-vue')

async function withNitro<T> (overrides: NuxtConfig, fn: (nitro: Nitro, nitroConfig: NitroConfig, nuxt: Nuxt) => T | Promise<T>) {
  let nitroConfig: NitroConfig | undefined
  let nitro: Nitro | undefined
  const nuxt = await loadNuxt({
    cwd: fixtureDir,
    dev: overrides.dev,
    ready: true,
    overrides: {
      ...overrides,
      _nitroMajor: 3,
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
  it('infers the prerenderer\'s runtime config schema from its own runtime config', async () => {
    await withNitro({ runtimeConfig: { assets: { dir: 'public' } } }, async (nitro) => {
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

  it('emits valid rest-of-path URLPatterns for noScripts wildcard rules', async () => {
    await withNitro({ routeRules: { '/foo/*': { noScripts: true }, '/scripted/*': { ssr: true } } }, async (_nitro, nitroConfig) => {
      const rendererConfig = nitroConfig.virtual!['nuxt/internal/renderer-config'] as () => Promise<string>
      const code = await rendererConfig()
      const patterns: string[] = JSON.parse(/^export const NUXT_NO_SCRIPTS_PATTERNS = (.+)$/m.exec(code)![1]!)

      expect(patterns).toEqual(['/foo/*'])
      const pattern = new URLPattern({ pathname: patterns[0] })
      expect(pattern.test('https://example.com/foo/bar')).toBe(true)
      expect(pattern.test('https://example.com/foo/bar/baz')).toBe(true)
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
    await withNitro({ experimental: { nitroViteEnvironment: false } }, (_nitro, nitroConfig, nuxt) => {
      expect(nitroConfig.replace).toMatchObject(serverReplacements(nuxt))
    })
  })

  it('leaves the server replacements to the vite `define` with nitroViteEnvironment', async () => {
    await withNitro({ experimental: { nitroViteEnvironment: true } }, (_nitro, nitroConfig, nuxt) => {
      if (!nuxt.options.experimental.nitroViteEnvironment) {
        expect(isNuxtMajorVersion(4, nuxt)).toBe(true)
        expect(nitroConfig.replace).toMatchObject(serverReplacements(nuxt))
        return
      }
      expect(nitroConfig.replace).not.toHaveProperty('__VUE_PROD_DEVTOOLS__')
    })
  })

  it.for([true, false])('passes the server replacements to the prerenderer when nitroViteEnvironment is %s', async (nitroViteEnvironment) => {
    await withNitro({ experimental: { nitroViteEnvironment } }, async (nitro, _nitroConfig, nuxt) => {
      // nitro creates the prerenderer from a copy of this config
      const prerendererConfig: NitroConfig = { ...nitro.options._config }
      await nitro.hooks.callHook('prerender:config', prerendererConfig)
      expect(prerendererConfig.replace).toMatchObject(serverReplacements(nuxt))
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

  const sourceMounts = {
    root: { driver: 'fs', readOnly: true, base: fixtureDir },
    src: { driver: 'fs', readOnly: true, base: resolve(fixtureDir, 'server') },
  }

  it.for([true, false])('mounts the project sources as read-only kv when dev is %s', async (dev) => {
    await withNitro({ dev }, (nitro) => {
      const mounts = { root: nitro.options.kv.root, src: nitro.options.kv.src }
      if (dev) {
        expect(mounts).toMatchObject(sourceMounts)
      } else {
        expect(mounts).toEqual({ root: undefined, src: undefined })
      }
    })
  })

  it('mounts the project sources as read-only kv in the prerenderer', async () => {
    await withNitro({ dev: false }, async (nitro) => {
      const prerenderer = await createNitro({ ...nitro.options._config, rootDir: nitro.options.rootDir, preset: 'nitro-prerender', logLevel: 0 })
      try {
        expect(prerenderer.options.kv).toMatchObject(sourceMounts)
      } finally {
        await prerenderer.close()
      }
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

  it('skips server auto-imports for paths in `nitro.imports.exclude`', async () => {
    await withNitro({ nitro: { imports: { exclude: [/[\\/]excluded[\\/]/, '/skipped/'] } } }, async (_nitro, nitroConfig) => {
      const plugin = [nitroConfig.rollupConfig!.plugins].flat().find(plugin => (plugin as { name?: string } | null)?.name === 'nuxt:server-auto-imports') as { transform: (code: string, id: string) => Promise<{ code: string } | undefined> }
      const code = 'export default () => useAppConfig()'

      expect(await plugin.transform.call({}, code, join(fixtureDir, 'server/api/hello.ts'))).toBeDefined()
      expect(await plugin.transform.call({}, code, join(fixtureDir, 'server/excluded/hello.ts'))).toBeUndefined()
      expect(await plugin.transform.call({}, code, join(fixtureDir, 'server/skipped/hello.ts'))).toBeUndefined()
    })
  })

  it.for([
    ['tsx', 'function dec<T> () { return (_method: () => unknown) => () => \'decorated\' as T }', '@dec<string>()'],
    ['jsx', 'function dec () { return () => () => \'decorated\' }', '@dec()'],
  ])('lowers decorators in `.%s` server files that contain JSX', async ([ext, declaration, decorator]) => {
    await withNitro({ experimental: { decorators: true } }, async (_nitro, nitroConfig) => {
      const id = join(fixtureDir, `server/api/decorated.${ext}`)
      const babel = [nitroConfig.rollupConfig!.plugins].flat().find((plugin) => {
        const { name, transform } = plugin as { name?: string, transform?: { filter: { id: RegExp } } }
        return name === 'babel' && transform!.filter.id.test(id)
      }) as { transform: { handler: (this: unknown, code: string, id: string) => Promise<{ code: string } | null> } }
      const code = [
        declaration,
        `class Decorated { ${decorator} method () { return 'initial' } }`,
        'export default () => <div>{new Decorated().method()}</div>',
      ].join('\n')

      const result = await babel.transform.handler.call({ error: (error: unknown) => { throw error } }, code, id)
      expect(result!.code).not.toContain(decorator)
      expect(result!.code).toContain('<div>{new Decorated().method()}</div>')
    })
  })

  it('only runs babel on server modules with decorators', async () => {
    await withNitro({ experimental: { decorators: true } }, async (_nitro, nitroConfig) => {
      type BabelPlugin = { name?: string, transform: { handler: (code: string, id: string) => Promise<{ code: string } | null> } }
      const plugins = [nitroConfig.rollupConfig!.plugins].flat().filter(plugin => (plugin as { name?: string } | null)?.name === 'babel') as BabelPlugin[]
      const transform = (index: number, code: string, id: string) => plugins[index]!.transform.handler.call({ error: (e: unknown) => { throw e } }, code, join(fixtureDir, id))

      expect(plugins).toHaveLength(2)
      expect(await transform(0, 'import { a } from "@scope/pkg"\n/** @internal */\nexport const b = /*@__PURE__*/ a("user@example.com")', 'server/utils/a.ts')).toBeNull()
      expect(await transform(1, 'export const C = () => <p title="user@example.com" />', 'server/utils/c.tsx')).toBeNull()
      expect((await transform(0, 'const d = (v: unknown) => v\n@d class E {}', 'server/utils/e.ts'))?.code).not.toContain('@d')
      expect((await transform(0, 'const d = <T>() => (v: T) => v\n@d<string>() class E {}', 'server/utils/f.ts'))?.code).not.toContain('@d')
      expect((await transform(1, 'const d = (v: unknown) => v\n@d class E {}', 'server/utils/e.tsx'))?.code).not.toContain('@d')
    })
  }, 60_000)

  it('shares the `@rspack/core` of the app builder with the nitro `rspack` builder', async () => {
    await withNitro({ builder: 'rspack', nitro: { builder: 'rspack' } }, (nitro, nitroConfig) => {
      const builderRspack = resolveModulePath('@rspack/core', { from: resolveModulePath('@nuxt/rspack-builder', { from: import.meta.url }) })
      expect(nitro.options.builder).toBe('rspack')
      expect(nitroConfig.deps?.paths?.['@rspack/core']).toBe(builderRspack)
      expect(nitroConfig.rolldownConfig).toBeUndefined()
    })
  })

  it('warns that `nitro.builder` is ignored with nitroViteEnvironment', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9008').mockImplementation(() => ({}) as any)
    onTestFinished(() => report.mockRestore())
    await withNitro({ experimental: { nitroViteEnvironment: true }, nitro: { builder: 'rspack' } }, (_nitro, nitroConfig, nuxt) => {
      if (!nuxt.options.experimental.nitroViteEnvironment) {
        expect(isNuxtMajorVersion(4, nuxt)).toBe(true)
        expect(report).not.toHaveBeenCalled()
        return
      }
      expect(report).toHaveBeenCalledWith({ builder: 'rspack' })
      expect(nitroConfig.rolldownConfig).toMatchObject({ tsconfig: false })
    })
  })

  it.for([4, 5])('resolves `#internal/nuxt/host` to the renderer host of a Nuxt %i app', async (major) => {
    await withNitro({ modules: [asNuxtMajor(major)] }, (_nitro, nitroConfig) => {
      expect(nitroConfig.alias!['#internal/nuxt/host']).toMatch(new RegExp(`runtime/host/nuxt${major}$`))
    })
  })

  it('resolves the h3 v1 helpers of a Nuxt 4 app to the h3 v1 shim', async () => {
    await withNitro({ modules: [asNuxtMajor(4)] }, async (_nitro, nitroConfig, nuxt) => {
      const plugin = findH3RuntimePlugin(nitroConfig)
      const entry = resolveModulePath('@nuxt/nitro-server/h3', { from: directoryToURL(nuxt.options.appDir) })
      expect(nitroConfig.alias!['@nuxt/nitro-server/h3']).toMatch(/runtime\/compat\/h3-v1/)
      expect(plugin!.resolveId.handler(entry)).toMatch(/runtime\/compat\/h3-v1/)
      expect(plugin!.resolveId.handler('h3')).toBeUndefined()

      const vitePlugin = await findViteH3RuntimePlugin(nuxt)
      expect(vitePlugin!.applyToEnvironment({ name: 'ssr' })).toBe(true)
      expect(vitePlugin!.applyToEnvironment({ name: 'client' })).toBe(false)
      expect(vitePlugin!.resolveId('@nuxt/nitro-server/h3')).toMatch(/runtime\/compat\/h3-v1/)
      expect(vitePlugin!.resolveId('h3')).toBeUndefined()
    })
  })

  it('leaves the h3 helpers of a Nuxt 5 app unaliased', async () => {
    await withNitro({ modules: [asNuxtMajor(5)] }, async (_nitro, nitroConfig, nuxt) => {
      expect(nitroConfig.alias!['@nuxt/nitro-server/h3']).toBeUndefined()
      expect(findH3RuntimePlugin(nitroConfig)).toBeUndefined()
      expect(await findViteH3RuntimePlugin(nuxt)).toBeUndefined()
    })
  })

  it('keys cached responses on their query for a Nuxt 4 app with the nitro v2 config layer', async () => {
    await withNitro({ modules: [asNuxtMajor(4)], nitroLegacy: true }, (_nitro, nitroConfig) => {
      expect(nitroConfig.cache?.defaults?.allowQuery).toBe(true)
    })
    await withNitro({ modules: [asNuxtMajor(4)], nitroLegacy: { config: false } }, (_nitro, nitroConfig) => {
      expect(nitroConfig.cache?.defaults?.allowQuery).toBeUndefined()
    })
    await withNitro({ modules: [asNuxtMajor(4)], nitroLegacy: true, nitro: { cache: { defaults: { allowQuery: ['page'] } } } }, (_nitro, nitroConfig) => {
      expect(nitroConfig.cache?.defaults?.allowQuery).toEqual(['page'])
    })
    await withNitro({ modules: [asNuxtMajor(5)], nitroLegacy: true }, (_nitro, nitroConfig) => {
      expect(nitroConfig.cache?.defaults?.allowQuery).toBeUndefined()
    })
  }, 60_000)

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
