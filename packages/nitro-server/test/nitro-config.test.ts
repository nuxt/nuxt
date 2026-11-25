import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it, vi } from 'vitest'
import { basename, dirname, isAbsolute, join, resolve } from 'pathe'
import { resolveModulePath } from 'exsolve'
import { rollup } from 'rollup'
import type { InputPluginOption, OutputAsset, OutputChunk, Plugin } from 'rollup'
import { loadNuxt } from '@nuxt/kit'
import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import { getRollupConfig } from 'nitropack/rollup'
import type { Nitro, NitroConfig } from 'nitropack/types'
import { nitroBuildDiagnostics } from '../src/diagnostics.ts'
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

const writePackage = async (dir: string, name: string, version: string, code: string) => {
  const entry = `dist/${name === 'vue' ? 'vue.runtime' : name.slice('@vue/'.length)}.esm-bundler.js`
  await mkdir(join(dir, dirname(entry)), { recursive: true })
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name, version, type: 'module', main: entry }))
  await writeFile(join(dir, entry), code)
  return join(dir, entry)
}

async function withNitro<T> (overrides: NuxtConfig, fn: (nitro: Nitro, nitroConfig: NitroConfig, nuxt: Nuxt) => T | Promise<T>) {
  let nitroConfig: NitroConfig | undefined
  let nitro: Nitro | undefined
  const nuxt = await loadNuxt({
    cwd: fixtureDir,
    dev: overrides.dev,
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

async function bundleRuntimeRouteRules (nitro: Nitro, config: ReturnType<typeof getRollupConfig>): Promise<Record<string, Record<string, any>>> {
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
  const entry = output.find(chunk => chunk.type === 'chunk' && chunk.facadeModuleId === 'entry') as OutputChunk
  const { default: runtimeConfig } = await import(`data:text/javascript,${encodeURIComponent(entry.code)}`)
  return runtimeConfig.nitro.routeRules
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

  it.for([
    { payloadExtraction: 'client' as const, expected: true },
    { payloadExtraction: false, expected: false },
  ])('renders cached payloads at runtime only when payload extraction is enabled ($payloadExtraction)', async ({ payloadExtraction, expected }) => {
    await withNitro({ experimental: { payloadExtraction }, routeRules: { '/**': { isr: 60 } } }, async (_nitro, nitroConfig) => {
      const rendererConfig = nitroConfig.virtual!['nuxt/internal/renderer-config'] as () => Promise<string>
      expect(await rendererConfig()).toContain(`export const NUXT_RUNTIME_PAYLOAD_EXTRACTION = ${expected}`)
    })
  })

  it('passes the server replacements to nitro as `replace`', async () => {
    await withNitro({}, (_nitro, nitroConfig) => {
      expect(nitroConfig.replace).toMatchObject(serverReplacements)
    })
  })

  it('lets the previous dev worker finish its requests for up to 10s on reload', async () => {
    await withNitro({}, (nitro) => {
      expect(nitro.options.devServer.drain).toEqual({ timeout: 10_000 })
    })
    await withNitro({ nitro: { devServer: { drain: false } } }, (nitro) => {
      expect(nitro.options.devServer.drain).toBe(false)
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
      const runtimeRouteRules = await bundleRuntimeRouteRules(nitro, config)

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

      expect(Object.keys(runtimeRouteRules)).toEqual(expect.arrayContaining([
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
      expect(runtimeRouteRules['/:slug/moved']!.redirect).toMatchObject({ to: '/new/:slug' })
    }).finally(() => rm(outputDir, { recursive: true, force: true }))
  }, 60_000)

  it.each([
    ['nitro:init', 'mutate'],
    ['nitro:init', 'reassign'],
    ['build:before', 'mutate'],
    ['build:before', 'reassign'],
    ['nitro:build:before', 'mutate'],
    ['nitro:build:before', 'reassign'],
    ['prerender:done', 'mutate'],
    ['prerender:done', 'reassign'],
    ['updateConfig', 'reassign'],
  ] as const)('passes the route rules as changed in `%s` (%s) to the server runtime', async (phase, mode) => {
    const outputDir = await mkdtemp(join(tmpdir(), 'nuxt-route-rules-'))
    const addRule = (nitro: Nitro) => {
      const rule = { headers: { 'x-added': '1' } }
      if (mode === 'mutate') {
        nitro.options.routeRules['/added'] = rule
      } else {
        nitro.options.routeRules = { ...nitro.options.routeRules, '/added': rule }
      }
    }
    const overrides: NuxtConfig = {
      dev: false,
      nitro: { output: { dir: outputDir } },
      routeRules: {
        '/:slug/about': { swr: 60 },
        '/:locale/:slug/about': { swr: 60 },
      },
      modules: [
        (_options, nuxt) => {
          nuxt.hook('nitro:init', (nitro) => {
            if (phase === 'nitro:init') { addRule(nitro) }
            nitro.hooks.hook('build:before', (nitro) => {
              if (phase === 'build:before') { addRule(nitro) }
            })
            nitro.hooks.hook('prerender:done', () => {
              if (phase === 'prerender:done') { addRule(nitro) }
            })
          })
          nuxt.hook('nitro:build:before', (nitro) => {
            if (phase === 'nitro:build:before') { addRule(nitro) }
          })
        },
      ],
    }
    await withNitro(overrides, async (nitro, _nitroConfig, nuxt) => {
      await nuxt.callHook('nitro:build:before', nitro)
      await nitro.hooks.callHook('prerender:done', { prerenderedRoutes: [], failedRoutes: [] })
      await nitro.hooks.callHook('build:before', nitro)
      await mkdir(nitro.options.output.serverDir, { recursive: true })
      const config = getRollupConfig(nitro)
      await nitro.hooks.callHook('rollup:before', nitro, config)
      let runtimeRouteRules = await bundleRuntimeRouteRules(nitro, config)
      if (phase === 'updateConfig') {
        await nitro.updateConfig({ routeRules: { ...nitro.options.routeRules, '/added': { headers: { 'x-added': '1' } } } })
        runtimeRouteRules = await bundleRuntimeRouteRules(nitro, config)
      }

      const builtIn = ['/__nuxt_error', '/_nuxt/**', '/_nuxt/builds/**', '/_nuxt/builds/meta/**']
      const configured = ['/:/:/about', '/:/about']
      const derived = ['/:/:/about/_payload.json', '/:/about/_payload.json', ...phase === 'updateConfig' ? [] : ['/added/_payload.json']]
      const expected = [...builtIn, ...configured, ...derived, '/added']
      expect(Object.keys(runtimeRouteRules).map(key => key.replace(/:[$\w]+/g, ':')).sort()).toEqual(expected.sort())
      expect(new Set(Object.keys(runtimeRouteRules).filter(key => key.endsWith('/about')).map(key => key.split('/')[1]))).toEqual(new Set([':slug']))
    }).finally(() => rm(outputDir, { recursive: true, force: true }))
  }, 60_000)

  it.each([
    ['reassigned without the built-in rules', true],
    ['reassigned with the existing rules', false],
    ['mutated', false],
  ] as const)('reports dropped built-in route rules once when the route rules are %s: %s', async (change, warns) => {
    const outputDir = await mkdtemp(join(tmpdir(), 'nuxt-route-rules-'))
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9017').mockImplementation(() => ({}) as ReturnType<typeof nitroBuildDiagnostics.NUXT_B9017>)
    const overrides: NuxtConfig = {
      dev: false,
      nitro: { output: { dir: outputDir } },
      experimental: { ssrStreaming: { enabled: true } },
      routeRules: { '/configured': { headers: { 'x-configured': '1' } } },
      modules: [
        (_options, nuxt) => {
          nuxt.hook('nitro:init', (nitro) => {
            nitro.hooks.hook('prerender:done', () => {
              const rule = { headers: { 'x-added': '1' } }
              if (change === 'mutated') {
                for (const key in nitro.options.routeRules) {
                  delete nitro.options.routeRules[key]
                }
                nitro.options.routeRules['/added'] = rule
              } else if (change === 'reassigned with the existing rules') {
                nitro.options.routeRules = { ...nitro.options.routeRules, '/added': rule }
              } else {
                nitro.options.routeRules = { '/added': rule }
              }
            })
          })
        },
      ],
    }
    await withNitro(overrides, async (nitro, _nitroConfig, nuxt) => {
      await nuxt.callHook('nitro:build:before', nitro)
      await nitro.hooks.callHook('prerender:done', { prerenderedRoutes: [], failedRoutes: [] })
      await nitro.hooks.callHook('build:before', nitro)
      await mkdir(nitro.options.output.serverDir, { recursive: true })
      await nitro.hooks.callHook('rollup:before', nitro, getRollupConfig(nitro))
      await nitro.hooks.callHook('rollup:before', nitro, getRollupConfig(nitro))

      if (warns) {
        expect(report).toHaveBeenCalledTimes(1)
        expect(report.mock.calls[0]![0].keys.split(', ').sort()).toEqual(['`/**`', '`/__nuxt_error`', '`/_nuxt/**`', '`/_nuxt/builds/**`', '`/_nuxt/builds/meta/**`'])
      } else {
        expect(report).not.toHaveBeenCalled()
      }
    }).finally(() => {
      report.mockRestore()
      return rm(outputDir, { recursive: true, force: true })
    })
  }, 60_000)

  it('bundles the `@vue/*` packages that vue depends on rather than hoisted copies', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'nuxt-vue-package-'))
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

  it('bundles the copy of vue the app resolves rather than the one nuxt depends on', async () => {
    const rootDir = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-vue-package-')))
    const nuxtDir = join(rootDir, 'node_modules/nuxt')
    const writeVue = async (dir: string, version: string) => {
      const runtimeCoreDir = join(dir, 'node_modules/@vue/runtime-core')
      await writePackage(dir, 'vue', version, `export * from '@vue/runtime-dom'`)
      await writePackage(join(dir, 'node_modules/@vue/runtime-dom'), '@vue/runtime-dom', version, `export * from '@vue/runtime-core'`)
      await writePackage(runtimeCoreDir, '@vue/runtime-core', version, `export * from '@vue/reactivity'`)
      await writePackage(join(runtimeCoreDir, 'node_modules/@vue/reactivity'), '@vue/reactivity', version, `export const version = '${version}'`)
    }
    try {
      await writeVue(join(nuxtDir, 'node_modules/vue'), '3.5.2')
      await writeVue(join(rootDir, 'node_modules/vue'), '3.5.3')

      const nuxt = { options: { dev: false, rootDir, appDir: join(nuxtDir, 'dist/app'), vue: {}, experimental: { externalVue: true } } } as unknown as Nuxt
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
              if (!importer?.startsWith(rootDir)) { return }
              return resolveModulePath(id, { from: importer, try: true }) ?? null
            },
            load: id => id === 'entry' ? 'export default 1' : undefined,
          },
        ],
      })
      const { output } = await bundle.generate({ format: 'esm' })
      await bundle.close()

      for (const name of ['vue', '@vue/runtime-dom', '@vue/runtime-core', '@vue/reactivity']) {
        const pkg = output.find((file): file is OutputAsset => file.fileName === `node_modules/${name}/package.json`)
        expect(JSON.parse(pkg!.source as string)).toMatchObject({ version: '3.5.3' })
      }
      const modules = output.flatMap(chunk => chunk.type === 'chunk' ? Object.keys(chunk.modules) : []).filter(id => id !== 'entry')
      expect(modules).toHaveLength(4)
      expect(modules.every(id => id.startsWith(join(rootDir, 'node_modules/vue/')))).toBe(true)
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  }, 60_000)

  it('allows traced CommonJS dependencies to require bundled vue without require(esm)', async () => {
    const execFileAsync = promisify(execFile)
    const rootDir = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-vue-cjs-')))
    const buildServer = async (name: string, version: string) => {
      const appDir = join(rootDir, name)
      const outDir = join(appDir, 'server')
      const vueDir = join(appDir, 'node_modules/vue')
      const runtimeDomDir = join(vueDir, 'node_modules/@vue/runtime-dom')
      const runtimeCoreDir = join(runtimeDomDir, 'node_modules/@vue/runtime-core')
      const reactivityDir = join(runtimeCoreDir, 'node_modules/@vue/reactivity')
      await writePackage(vueDir, 'vue', version, `export * from '@vue/runtime-dom'\nexport let state = ${JSON.stringify(name)}\nexport function setState (v) { state = v }`)
      await writePackage(runtimeDomDir, '@vue/runtime-dom', version, `export * from '@vue/runtime-core'`)
      await writePackage(runtimeCoreDir, '@vue/runtime-core', version, `export * from '@vue/reactivity'`)
      await writePackage(reactivityDir, '@vue/reactivity', version, `export const token = { name: ${JSON.stringify(name)} }`)

      const nuxt = { options: { dev: false, rootDir: appDir, appDir: join(appDir, 'app'), vue: {}, experimental: { externalVue: true } } } as unknown as Nuxt
      const nitro = { options: { node: true, externals: {}, rollupConfig: {} } } as unknown as Nitro
      setupVuePackage(nuxt, nitro)

      const bundle = await rollup({
        input: 'entry',
        external: ['esm-wrapper'],
        plugins: [
          ...nitro.options.rollupConfig!.plugins as Plugin[],
          {
            name: 'entry',
            resolveId (id, importer) {
              if (id === 'entry') { return id }
              const from = importer === 'entry' ? join(appDir, 'entry.js') : importer
              if (!from?.startsWith(appDir)) { return }
              return resolveModulePath(id, { from, try: true }) ?? null
            },
            load: id => id === 'entry'
              ? `import { getDep } from 'esm-wrapper'\nimport { setState, state, token } from 'vue'\nexport { getDep, setState, state, token }`
              : undefined,
          },
        ],
      })
      await bundle.write({ dir: outDir, format: 'esm', entryFileNames: 'index.mjs' })
      await bundle.close()

      await mkdir(join(outDir, 'node_modules/esm-wrapper'), { recursive: true })
      await writeFile(join(outDir, 'node_modules/esm-wrapper/package.json'), JSON.stringify({ name: 'esm-wrapper', type: 'module', main: './index.js' }))
      await writeFile(join(outDir, 'node_modules/esm-wrapper/index.js'), `import dep from 'cjs-dep'\nimport { token } from 'vue'\nexport function getDep () { return { dep, esmToken: token } }\n`)

      await mkdir(join(outDir, 'node_modules/cjs-dep'), { recursive: true })
      await writeFile(join(outDir, 'node_modules/cjs-dep/package.json'), JSON.stringify({ name: 'cjs-dep', main: './index.js' }))
      await writeFile(join(outDir, 'node_modules/cjs-dep/index.js'), `const vue = require('vue')\nconst reactivity = require('@vue/reactivity')\nmodule.exports = { vue, reactivity }\n`)

      return outDir
    }

    try {
      const serverA = await buildServer('app-a', '3.5.1')
      const serverB = await buildServer('app-b', '3.5.2')

      const script = `
        import assert from 'node:assert/strict'
        const a = await import(${JSON.stringify(pathToFileURL(join(serverA, 'index.mjs')).href)})
        const b = await import(${JSON.stringify(pathToFileURL(join(serverB, 'index.mjs')).href)})

        const resA = a.getDep()
        const resB = b.getDep()

        assert.equal(resA.dep.vue.__esModule, true)
        assert.equal(Object.getPrototypeOf(resA.dep.vue), Object.prototype)
        assert.equal(resA.dep.vue.token, a.token)
        assert.equal(resA.dep.vue.token, resA.esmToken)
        assert.equal(resA.dep.reactivity.token, a.token)

        assert.equal(resB.dep.vue.token, b.token)
        assert.equal(resB.dep.reactivity.token, b.token)
        assert.notEqual(resA.dep.vue.token, resB.dep.vue.token)

        assert.equal(resA.dep.vue.state, 'app-a')
        a.setState('updated-a')
        assert.equal(resA.dep.vue.state, 'updated-a')
        assert.equal(resB.dep.vue.state, 'app-b')
      `
      await execFileAsync(process.execPath, ['--no-experimental-require-module', '--input-type=module', '-e', script])

      const fallbackScript = `
        import assert from 'node:assert/strict'
        import { createRequire } from 'node:module'
        const req = createRequire(${JSON.stringify(join(serverA, 'node_modules/cjs-dep/index.js'))})
        assert.equal(globalThis[Symbol.for('nuxt.vue')], undefined)
        assert.ok(req.resolve('vue').endsWith('index.cjs'))
        const cjsVue = req('vue')
        const esmVue = await import(${JSON.stringify(pathToFileURL(join(serverA, 'node_modules/vue/index.mjs')).href)})
        assert.equal(cjsVue.token, esmVue.token)
        assert.equal(globalThis[Symbol.for('nuxt.vue')], undefined)
      `
      await execFileAsync(process.execPath, ['--input-type=module', '-e', fallbackScript])
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  }, 60_000)

  it('strips unused nitro `_importMeta_` stubs from emitted vue packages and keeps shebangs first', async () => {
    const rootDir = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-vue-entry-')))
    try {
      await writePackage(join(rootDir, 'node_modules/vue'), 'vue', '3.5.4', `export const version = '3.5.4'`)

      const nuxt = { options: { dev: false, rootDir, appDir: join(rootDir, 'app'), vue: {}, experimental: { externalVue: true } } } as unknown as Nuxt
      const nitro = { options: { node: true, externals: {}, rollupConfig: {} } } as unknown as Nitro
      setupVuePackage(nuxt, nitro)

      const bundle = await rollup({
        input: 'entry',
        plugins: [
          {
            name: 'mock-nitro-import-meta',
            renderChunk (code, chunk) {
              if (!chunk.isEntry) { return }
              const prefix = chunk.fileName === 'entry.js'
                ? `#!/usr/bin/env node\nimport process from 'node:process';globalThis._importMeta_={url:import.meta.url,env:process.env};`
                : `import process from 'node:process';globalThis._importMeta_={url:import.meta.url,env:process.env};`
              return { code: prefix + code, map: null }
            },
          },
          ...nitro.options.rollupConfig!.plugins as Plugin[],
          {
            name: 'entry',
            resolveId (id, importer) {
              if (id === 'entry') { return id }
              const from = importer === 'entry' ? join(rootDir, 'entry.js') : importer
              if (!from?.startsWith(rootDir)) { return }
              return resolveModulePath(id, { from, try: true }) ?? null
            },
            load: id => id === 'entry' ? `export { version } from 'vue'` : undefined,
          },
        ],
      })
      const { output } = await bundle.generate({ format: 'esm' })
      await bundle.close()

      const entryChunk = output.find((file): file is OutputChunk => file.type === 'chunk' && file.fileName === 'entry.js')!
      expect(entryChunk.code.startsWith('#!/usr/bin/env node\nimport "./chunks/_/vue-cjs.mjs";')).toBe(true)

      const vueChunk = output.find((file): file is OutputChunk => file.type === 'chunk' && file.fileName === 'node_modules/vue/index.mjs')!
      expect(vueChunk.code).not.toContain('_importMeta_')
      expect(vueChunk.code).not.toContain('node:process')
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

  it('reports the same typed server routes in dev as in `nuxt prepare`', async () => {
    const serverHandlers = [{ route: '/api/debug', env: 'dev' as const, handler: resolve(fixtureDir, 'server/api/debug.dev.ts') }]
    const getRoutes = (overrides: NuxtConfig) => withNitro({ ...overrides, serverHandlers }, async (_nitro, _config, nuxt) => {
      const routes: Array<{ route?: string, middleware?: boolean }> = []
      await nuxt.callHook('server:routes', routes as any, {} as any)
      return routes.filter(r => !r.middleware).map(r => r.route)
    })
    const devRoutes = await getRoutes({ dev: true })
    expect(devRoutes).toContain('/api/debug')
    expect(devRoutes).toEqual(await getRoutes({ _prepare: true }))
  })

  it('registers the same typed plugins in dev as in `nuxt prepare`', async () => {
    const getPlugins = (overrides: NuxtConfig) => withNitro({ ...overrides, pages: true }, (_nitro, _config, nuxt) => {
      return nuxt.options.plugins.filter(p => typeof p === 'string' || !p._skipTypes).map(p => typeof p === 'string' ? p : p.src)
    })
    const devPlugins = await getPlugins({ dev: true })
    expect(devPlugins).not.toEqual([])
    expect(devPlugins).toEqual(await getPlugins({ _prepare: true }))
  })

  it.each([
    [{ dev: false, logLevel: 'info' }, 1],
    [{ dev: false, logLevel: 'verbose' }, 1],
    [{ dev: false, logLevel: 'silent' }, 0],
    [{ dev: false, logLevel: 'info', nitro: { logLevel: 3 } }, 3],
    [{ dev: true, logLevel: 'info' }, 3],
  ] satisfies Array<[NuxtConfig, number]>)('only prints warnings and errors from nitro in a production build unless the project sets a level (%j)', async (overrides, logLevel) => {
    await withNitro(overrides, (nitro) => {
      expect(nitro.options.logLevel).toBe(logLevel)
    })
  }, 60_000)

  it('describes the deploy command of the preset, to run from the project root', async () => {
    await withNitro({ dev: false, nitro: { commands: { deploy: 'npx wrangler --cwd ./ pages deploy' }, output: { dir: 'my output' } } }, (_nitro, _nitroConfig, nuxt) => {
      expect(nuxt.serverBuild.deploy?.command?.()).toBe('npx wrangler --cwd "my output/" pages deploy')
    })
    await withNitro({ dev: false }, (_nitro, _nitroConfig, nuxt) => {
      expect(nuxt.serverBuild.deploy?.command?.()).toBeUndefined()
    })
  }, 60_000)

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
