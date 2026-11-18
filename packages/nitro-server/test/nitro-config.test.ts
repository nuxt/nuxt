import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { basename, dirname, isAbsolute, join, resolve } from 'pathe'
import { resolveModulePath } from 'exsolve'
import { rollup } from 'rollup'
import type { InputPluginOption, OutputAsset, OutputChunk, Plugin } from 'rollup'
import { loadNuxt } from '@nuxt/kit'
import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import { getRollupConfig } from 'nitropack/rollup'
import type { Nitro, NitroConfig } from 'nitropack/types'
import { RUNTIME_CONFIG_SCHEMA_ID } from '../src/runtime-config.ts'
import { setupVuePackage } from '../src/vue-package.ts'

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

  it('keeps route rule keys as written and unifies sibling dynamic segments for the server runtime', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'nuxt-route-rules-'))
    const overrides: NuxtConfig = {
      dev: false,
      nitro: { output: { dir: outputDir } },
      routeRules: {
        '/package/:name/_payload.json': { isr: 300 },
        '/package/:org/:name/_payload.json': { isr: 300 },
        '/:slug/about': { swr: 60 },
        '/:locale/:slug/about': { swr: 60 },
        '/:locale/moved': { redirect: { to: '/new/:locale', statusCode: 301 } },
      },
      modules: [
        (_options, nuxt) => {
          nuxt.options.routeRules!['/team/:slug/view'] = { swr: 60 }
          nuxt.hook('nitro:config', (config) => {
            config.routeRules!['/team/:id/edit'] = { swr: 60 }
          })
        },
      ],
    }
    await withNitro(overrides, async (nitro) => {
      await nitro.hooks.callHook('build:before', nitro)
      await mkdir(nitro.options.output.serverDir, { recursive: true })
      const config = getRollupConfig(nitro)
      await nitro.hooks.callHook('rollup:before', nitro, config)
      const bundle = await rollup({
        ...config,
        input: 'entry',
        plugins: [
          {
            name: 'entry',
            resolveId: id => id === 'entry' ? id : undefined,
            load: id => id === 'entry' ? 'export default process.env.RUNTIME_CONFIG' : undefined,
          },
          ...config.plugins as InputPluginOption[],
        ],
      })
      const { output } = await bundle.generate({ format: 'esm' })
      await bundle.close()

      expect(Object.keys(nitro.options.routeRules)).toEqual(expect.arrayContaining([
        '/package/:name/_payload.json',
        '/package/:org/:name/_payload.json',
        '/:slug/about',
        '/:slug/about/_payload.json',
        '/:locale/:slug/about',
        '/:locale/:slug/about/_payload.json',
        '/:locale/moved',
        '/team/:slug/view',
        '/team/:id/edit',
      ]))
      expect(nitro.options.routeRules['/:locale/moved']!.redirect).toMatchObject({ to: '/new/:locale' })

      const entry = output.find(chunk => chunk.type === 'chunk' && chunk.facadeModuleId === 'entry') as OutputChunk
      const { default: runtimeConfig } = await import(`data:text/javascript,${encodeURIComponent(entry.code)}`)
      expect(Object.keys(runtimeConfig.nitro.routeRules)).toEqual(expect.arrayContaining([
        '/package/:name/_payload.json',
        '/package/:name/:name_/_payload.json',
        '/:slug/about',
        '/:slug/about/_payload.json',
        '/:slug/:slug_/about',
        '/:slug/:slug_/about/_payload.json',
        '/:slug/moved',
        '/team/:slug/view',
        '/team/:slug/edit',
      ]))
      expect(runtimeConfig.nitro.routeRules['/:slug/moved'].redirect).toMatchObject({ to: '/new/:slug' })
    }).finally(() => rm(outputDir, { recursive: true, force: true }))
  }, 60_000)

  it('bundles the `@vue/*` packages that vue depends on rather than hoisted copies', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'nuxt-vue-package-'))
    const writePackage = async (dir: string, name: string, version: string, code: string) => {
      const entry = `dist/${name === 'vue' ? 'vue.runtime' : name.slice('@vue/'.length)}.esm-bundler.js`
      await mkdir(join(dir, dirname(entry)), { recursive: true })
      await writeFile(join(dir, 'package.json'), JSON.stringify({ name, version, type: 'module', main: entry }))
      await writeFile(join(dir, entry), code)
      return join(dir, entry)
    }
    try {
      const vueDir = join(rootDir, 'node_modules/vue')
      const runtimeDomDir = join(vueDir, 'node_modules/@vue/runtime-dom')
      const runtimeCoreDir = join(runtimeDomDir, 'node_modules/@vue/runtime-core')
      await writePackage(vueDir, 'vue', '3.5.2', `export * from '@vue/runtime-dom'`)
      await writePackage(runtimeDomDir, '@vue/runtime-dom', '3.5.2', `export * from '@vue/runtime-core'`)
      const expected = {
        '@vue/runtime-core': await writePackage(runtimeCoreDir, '@vue/runtime-core', '3.5.2', `export * from '@vue/reactivity'`),
        '@vue/reactivity': await writePackage(join(runtimeCoreDir, 'node_modules/@vue/reactivity'), '@vue/reactivity', '3.5.2', `export const version = '3.5.2'`),
      }
      for (const name of Object.keys(expected)) {
        await writePackage(join(rootDir, 'node_modules', name), name, '3.5.1', `export const version = '3.5.1'`)
      }

      const nuxt = { options: { dev: false, appDir: join(rootDir, 'app'), vue: {}, experimental: { externalVue: true } } } as unknown as Nuxt
      const nitro = { options: { node: true, externals: {}, rollupConfig: {} } } as unknown as Nitro
      setupVuePackage(nuxt, nitro)

      const bundle = await rollup({
        input: 'entry',
        plugins: [
          ...nitro.options.rollupConfig!.plugins as Plugin[],
          {
            name: 'entry',
            resolveId (id, importer) {
              if (id === 'entry') { return id }
              if (!importer || id.startsWith('.') || id.startsWith('/')) { return }
              const resolved = resolveModulePath(id, { from: importer, try: true })
              return resolved?.startsWith(rootDir) ? resolved : null
            },
            load: id => id === 'entry' ? `export { version } from 'vue'` : undefined,
          },
        ],
      })
      const { output } = await bundle.generate({ format: 'esm' })
      await bundle.close()

      const modules = output.flatMap(chunk => chunk.type === 'chunk' ? Object.keys(chunk.modules) : [])
      for (const [name, entry] of Object.entries(expected)) {
        expect(modules.filter(id => basename(id) === basename(entry))).toEqual([entry])
        const pkg = output.find((file): file is OutputAsset => file.fileName === `node_modules/${name}/package.json`)
        expect(JSON.parse(pkg!.source as string)).toMatchObject({ version: '3.5.2' })
      }
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

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
})
