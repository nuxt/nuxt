import { existsSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { dirname, isAbsolute, join, resolve } from 'pathe'
import { directoryToURL, isNuxtMajorVersion, loadNuxt, updateRuntimeConfig, writeTypes } from '@nuxt/kit'
import { z } from 'zod'
import { createNitro } from 'nitro/builder'
import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import type { Nitro, NitroConfig } from 'nitro/types'
import { resolveModulePath } from 'exsolve'
import { nitroBuildDiagnostics } from '../src/diagnostics.ts'
import { RUNTIME_CONFIG_SCHEMA_ID } from '../src/runtime-config.ts'
import { distDir } from '../src/utils.ts'

const fixtureDir = resolve(import.meta.dirname, '../../../test/fixtures/minimal')

const serverReplacements = (nuxt: Nuxt) => ({
  'process.env.NODE_ENV': '"production"',
  '__VUE_OPTIONS_API__': String(!!nuxt.options.vue.optionsApi),
  '__VUE_PROD_DEVTOOLS__': 'false',
  '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false',
  'import.meta.test': 'false',
})

const loadSchemaModule = (nitro: Nitro): Promise<{ default: Record<string, any>, strictPaths?: string[] }> =>
  import(`data:text/javascript,${encodeURIComponent((nitro.options.virtual[RUNTIME_CONFIG_SCHEMA_ID] as () => string)())}`)

const asNuxtMajor = (major: number) => (_options: unknown, nuxt: Nuxt) => {
  nuxt._version = `${major}.0.0`
}

const findH3RuntimePlugin = (nitroConfig: NitroConfig) => ([nitroConfig.rollupConfig!.plugins].flat() as Array<{ name?: string, resolveId: { handler: (id: string) => string | undefined | Promise<string | undefined> } }>)
  .find(plugin => plugin?.name === 'nuxt:nitro:h3-v1-runtime')

async function findViteH3RuntimePlugin (nuxt: Nuxt) {
  const config = { environments: { ssr: {}, client: {} }, plugins: [] }
  await nuxt.callHook('vite:extend', { nuxt, config } as any)
  return (config.plugins.flat() as Array<{ name?: string, applyToEnvironment: (environment: { name: string }) => boolean, resolveId: (id: string, importer?: string) => string | undefined }>)
    .find(plugin => plugin?.name === 'nuxt:nitro:h3-v1-runtime')
}

function h3Entry (major: '1' | '2') {
  if (major === '2') {
    return resolveModulePath('h3', { from: import.meta.url })
  }
  const dir = join(mkdtempSync(join(tmpdir(), 'nitro-h3-v1-')), 'node_modules/h3')
  mkdirSync(join(dir, 'dist'), { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'h3', version: '1.15.11', exports: { '.': { types: './dist/index.d.ts', import: './dist/index.mjs', require: './dist/index.cjs' } } }))
  writeFileSync(join(dir, 'dist/index.mjs'), '')
  return join(dir, 'dist/index.mjs')
}

async function withTsConfigs (overrides: NuxtConfig) {
  const buildDir = await mkdtemp(join(tmpdir(), 'nitro-server-tsconfig-'))
  onTestFinished(() => rm(buildDir, { recursive: true, force: true }))
  return withNitro({ ...overrides, buildDir, typesDir: buildDir }, async (_nitro, _nitroConfig, nuxt) => {
    await writeTypes(nuxt)
    const readPaths = async (name: string): Promise<Record<string, string[]>> => JSON.parse(await readFile(join(buildDir, name), 'utf8')).compilerOptions.paths
    const [server, app, shared] = await Promise.all(['tsconfig.server.json', 'tsconfig.app.json', 'tsconfig.shared.json'].map(readPaths))
    return { buildDir, server: server!, app: app!, shared: shared!, serverDeclaration: await readFile(join(buildDir, 'nuxt.server.d.ts'), 'utf8') }
  })
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

      expect((await loadSchemaModule(nitro)).default.p.assets).toEqual({ p: { dir: 's' } })
      expect((await loadSchemaModule(prerenderer)).default.p.assets).toEqual({ p: { dir: { a: 's' } } })
    })
  }, 60_000)

  it.for([
    [4, 4, ['apiSecret']],
    [4, 5, undefined],
    [5, 5, undefined],
  ] as const)('emits the strict runtime config paths of a Nuxt %i app with `compatibilityVersion: %i`', async ([major, compatibilityVersion, strictPaths]) => {
    const schemaModule = (_options: unknown, nuxt: Nuxt) => {
      nuxt._version = `${major}.0.0`
      ;(nuxt.options.future as { compatibilityVersion: number }).compatibilityVersion = compatibilityVersion
      updateRuntimeConfig({ moduleToken: z.string().default('token') })
    }
    await withNitro({ modules: [schemaModule], runtimeConfig: { apiSecret: z.string().default('secret') } as NuxtConfig['runtimeConfig'] }, async (nitro) => {
      const { default: schema, strictPaths: emitted } = await loadSchemaModule(nitro)
      expect(Object.keys(schema.p)).toEqual(expect.arrayContaining(['apiSecret', 'moduleToken']))
      expect(emitted).toEqual(strictPaths)
    })
  })

  it.for([true, false])('registers routes at the root for a relative `app.baseURL` when static is %s', async (isStatic) => {
    await withNitro({ app: { baseURL: './' }, nitro: { static: isStatic } }, (nitro, _nitroConfig, nuxt) => {
      expect(nuxt.options.app.baseURL).toBe('./')
      expect(nitro.options.baseURL).toBe('/')
      expect(nitro.routing.routeRules.routes.map(route => route.route)).toContain('/**')
    })
  })

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

  it.for(['webpack:config', 'rspack:config'] as const)('aliases vue to the esm-bundler build in a client config without `resolve.alias` on `%s`', async (hook) => {
    await withNitro({ vue: { runtimeCompiler: true } }, async (_nitro, _nitroConfig, nuxt) => {
      const configs = [{ name: 'client' }, { name: 'client', resolve: {} }]
      for (const config of configs) {
        await nuxt.callHook(hook, [config] as any)
      }
      expect(configs.map(config => config.resolve)).toEqual([
        { alias: { vue: 'vue/dist/vue.esm-bundler' } },
        { alias: { vue: 'vue/dist/vue.esm-bundler' } },
      ])
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

  it.each([
    ['false', false, []],
    ['undefined', undefined, []],
    ['an array', ['my-module', /^my-other-module/], ['my-module', /^my-other-module/]],
  ] as const)('keeps the nuxt `noExternals` entries in dev with `nitro.noExternals` set to %s', async (_name, noExternals, extra) => {
    await withNitro({ dev: true, nitro: { noExternals: noExternals as NitroConfig['noExternals'] } }, (nitro) => {
      const entries = nitro.options.noExternals as Array<string | RegExp>
      expect(entries).toEqual(expect.arrayContaining(['nuxt/dist', distDir, ...extra]))
    })
  })

  it('bundles everything with `nitro.noExternals: true`', async () => {
    await withNitro({ dev: true, nitro: { noExternals: true } }, (nitro) => {
      expect(nitro.options.noExternals).toBe(true)
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

  it.for([
    [4, false, true],
    [4, true, false],
    [5, false, false],
  ] as const)('keeps the arrival request for the error handler on a Nuxt %i host with `inlineErrorRendering: %s`: %s', async ([major, inlineErrorRendering, expected]) => {
    await withNitro({ modules: [asNuxtMajor(major)], experimental: { inlineErrorRendering } }, (_nitro, nitroConfig) => {
      expect((nitroConfig.plugins as string[]).some(plugin => /runtime[\\/]plugins[\\/]arrival-request$/.test(plugin))).toBe(expected)
    })
  })

  it.for([4, 5])('maps the app and project root aliases in the server tsconfig of a Nuxt %i app', async (major) => {
    const buildDir = await mkdtemp(join(tmpdir(), 'nitro-server-tsconfig-'))
    onTestFinished(() => rm(buildDir, { recursive: true, force: true }))
    await withNitro({ buildDir, typesDir: buildDir, modules: [asNuxtMajor(major)] }, async (_nitro, _nitroConfig, nuxt) => {
      await writeTypes(nuxt)
      const paths: Record<string, string[]> = JSON.parse(await readFile(join(buildDir, 'tsconfig.server.json'), 'utf8')).compilerOptions.paths

      for (const alias of ['~', '@']) {
        expect(resolve(buildDir, paths[`${alias}/*`]![0]!)).toBe(join(nuxt.options.srcDir, '*'))
      }
      for (const alias of ['~~', '@@']) {
        expect(resolve(buildDir, paths[`${alias}/*`]![0]!)).toBe(join(nuxt.options.rootDir, '*'))
      }
    })
  })

  it.for([4, 5])('types `h3` in the server program of a Nuxt %i app that depends on `h3` as Nitro\'s h3 with `nitroLegacy.h3`', async (major) => {
    const nitroH3 = dirname(resolveModulePath('h3/package.json', { from: resolveModulePath('nitro/package.json', { from: import.meta.url }) }))
    const dependsOnH3 = (_options: unknown, nuxt: Nuxt) => {
      nuxt._dependencies = new Set([...nuxt._dependencies || [], 'h3'])
    }
    for (const nitroLegacy of [{ h3: true }, { h3: false }]) {
      const tsconfigs = await withTsConfigs({ modules: [asNuxtMajor(major), dependsOnH3], nitroLegacy })
      const h3Path = tsconfigs.server.h3?.[0]
      expect(h3Path && realpathSync(resolve(tsconfigs.buildDir, h3Path))).toBe(nitroLegacy.h3 ? realpathSync(nitroH3) : undefined)
      expect(tsconfigs.app.h3).toBeUndefined()
      expect(tsconfigs.shared.h3).toBeUndefined()
    }
  })

  it.for([4, 5])('types `nitropack` and `nitropack/types` in the server program of a Nuxt %i app as Nitro\'s types with `nitroLegacy.specifiers`', async (major) => {
    for (const specifiers of [true, false]) {
      const tsconfigs = await withTsConfigs({ modules: [asNuxtMajor(major)], nitroLegacy: { specifiers } })
      for (const specifier of ['nitropack', 'nitropack/types']) {
        const declaration = expect(tsconfigs.server[specifier]?.[0])
        if (specifiers) {
          declaration.toMatch(/runtime\/compat\/nitro-v2-types$/)
        } else {
          declaration.not.toMatch(/nitro-v2-types/)
        }
      }
      const firstReference = tsconfigs.serverDeclaration.split('\n')[0]
      if (specifiers) {
        expect(firstReference).toMatch(/^\/\/\/ <reference path=".*runtime\/compat\/nitro-v2-types(?:\.d)?\.ts" \/>$/)
      } else {
        expect(tsconfigs.serverDeclaration).not.toContain('nitro-v2-types')
      }
      for (const specifier of ['nitropack/runtime', '#internal/nitro']) {
        expect(tsconfigs.server[specifier]?.[0]).not.toMatch(/nitro-v2-types/)
      }
    }
  })

  it('resolves the h3 v1 helpers of a Nuxt 4 app to the app h3 v1 shim', async () => {
    await withNitro({ modules: [asNuxtMajor(4)], nitroLegacy: { h3: false } }, async (_nitro, nitroConfig, nuxt) => {
      const plugin = findH3RuntimePlugin(nitroConfig)
      const entry = resolveModulePath('@nuxt/nitro-server/h3', { from: directoryToURL(nuxt.options.appDir) })
      expect(nitroConfig.alias!['@nuxt/nitro-server/h3']).toMatch(/runtime\/compat\/h3-v1-app\.[mt]s$/)
      expect(await plugin!.resolveId.handler(entry)).toMatch(/runtime\/compat\/h3-v1-app\.[mt]s$/)
      expect(await plugin!.resolveId.handler('h3')).toBeUndefined()
      expect(await plugin!.resolveId.handler(h3Entry('1'))).toBeUndefined()

      const vitePlugin = await findViteH3RuntimePlugin(nuxt)
      expect(vitePlugin!.applyToEnvironment({ name: 'ssr' })).toBe(true)
      expect(vitePlugin!.applyToEnvironment({ name: 'client' })).toBe(false)
      expect(vitePlugin!.resolveId('@nuxt/nitro-server/h3')).toMatch(/runtime\/compat\/h3-v1-app\.[mt]s$/)
      expect(vitePlugin!.resolveId('h3', join(nuxt.options.srcDir, 'components/Test.vue'))).toBeUndefined()
    })
  })

  it('resolves `h3` in the server build of a Nuxt 4 app to the app h3 v1 shim with `nitroLegacy.h3`', async () => {
    await withNitro({ modules: [asNuxtMajor(4)], nitroLegacy: { h3: true } }, async (_nitro, nitroConfig, nuxt) => {
      const appShim = /runtime\/compat\/h3-v1-app\.[mt]s$/
      const vitePlugin = await findViteH3RuntimePlugin(nuxt)
      expect(vitePlugin!.applyToEnvironment({ name: 'client' })).toBe(false)
      expect(vitePlugin!.resolveId('h3', join(nuxt.options.srcDir, 'components/Test.vue'))).toMatch(appShim)
      expect(vitePlugin!.resolveId('h3', '/project/node_modules/some-module/dist/runtime/components/Test.vue')).toMatch(appShim)
      expect(vitePlugin!.resolveId('h3', '/project/node_modules/nitro/lib/h3.mjs')).toBeUndefined()
      expect(vitePlugin!.resolveId('h3', '/project/node_modules/.pnpm/h3@2.0.0/node_modules/h3/dist/index.mjs')).toBeUndefined()
      expect(vitePlugin!.resolveId('h3/rules', join(nuxt.options.srcDir, 'components/Test.vue'))).toBeUndefined()

      const plugin = findH3RuntimePlugin(nitroConfig)
      expect(nitroConfig.alias!.h3).toBeUndefined()
      expect(await plugin!.resolveId.handler('h3')).toBeUndefined()
      expect(await plugin!.resolveId.handler(h3Entry('1'))).toMatch(appShim)
      expect(await plugin!.resolveId.handler(h3Entry('2'))).toMatch(appShim)
      expect(await plugin!.resolveId.handler(resolveModulePath('h3/rules', { from: import.meta.url }))).toBeUndefined()
    })
  })

  it('leaves the h3 helpers of a Nuxt 5 app unaliased', async () => {
    await withNitro({ modules: [asNuxtMajor(5)], nitroLegacy: true }, async (_nitro, nitroConfig, nuxt) => {
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

  it('lets dev error reports read the server bundle the vite dev server denies', async () => {
    const buildDir = await mkdtemp(join(tmpdir(), 'nuxt-[dev](x)@-'))
    onTestFinished(() => rm(buildDir, { recursive: true, force: true }))
    await withNitro({ dev: true, buildDir }, async (nitro, _nitroConfig, nuxt) => {
      const outputPattern = `${resolve(nitro.options.output.serverDir).replace(/[\\*?[\]{}()!+@|]/g, '\\$&')}/**`
      const fs = { allow: [nuxt.options.rootDir], deny: ['.env', '**/app-secret', outputPattern], strict: true }
      await nuxt.callHook('vite:serverCreated', { config: { server: { fs, allowedHosts: [] } } } as any, { isClient: true, isServer: false })

      const options = await (nitro.options.virtual['#internal/dev-server-logs-options'] as () => string)()
      const reportFs = JSON.parse(/^export const reportFs = (.+);$/m.exec(options)![1]!)
      expect(reportFs).toEqual({ ...fs, deny: ['.env', '**/app-secret'] })
    })
  }, 60_000)
})
