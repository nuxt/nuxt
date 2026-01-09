import { pathToFileURL } from 'node:url'
import { existsSync, promises as fsp, readFileSync } from 'node:fs'
import { cpus } from 'node:os'
import process from 'node:process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import type { Nuxt, NuxtOptions } from '@nuxt/schema'
import { join, relative, resolve } from 'pathe'
import { readPackageJSON } from 'pkg-types'
import { joinURL, withTrailingSlash } from 'ufo'
import { build, copyPublicAssets, createDevServer, createNitro, prepare, prerender, writeTypes } from 'nitro/builder'
import type { Nitro, NitroConfig, NitroRouteRules } from 'nitro/types'
import { addPlugin, addTemplate, addVitePlugin, createIsIgnored, findPath, getDirectory, getLayerDirectories, logger, resolveAlias, resolveIgnorePatterns, resolveNuxtModule } from '@nuxt/kit'
import escapeRE from 'escape-string-regexp'
import { defu } from 'defu'
import { defineEventHandler, dynamicEventHandler, handleCors } from 'nitro/h3'
import { isWindows } from 'std-env'
import { ImpoundPlugin } from 'impound'
import { resolveModulePath } from 'exsolve'
import './augments.ts'

import nitroBuilder from '../package.json' with { type: 'json' }
import { distDir, toArray } from './utils.ts'
import { template as defaultSpaLoadingTemplate } from '../../ui-templates/dist/templates/spa-loading-icon.ts'
// TODO: figure out a good way to share this
import { createImportProtectionPatterns } from '../../nuxt/src/core/plugins/import-protection.ts'
import { nitroSchemaTemplate } from './templates.ts'
import { getH3ImportsPreset, v2ImportsPreset } from './imports.ts'

const logLevelMapReverse = {
  silent: 0,
  info: 3,
  verbose: 3,
} satisfies Record<NuxtOptions['logLevel'], NitroConfig['logLevel']>

const NODE_MODULES_RE = /(?<=\/)node_modules\/(.+)$/
const PNPM_NODE_MODULES_RE = /\.pnpm\/.+\/node_modules\/(.+)$/
export async function bundle (nuxt: Nuxt & { _nitro?: Nitro }): Promise<void> {
  // Resolve config
  const layerDirs = getLayerDirectories(nuxt)
  const excludePaths: string[] = []
  for (const dirs of layerDirs) {
    const paths = [
      dirs.root.match(NODE_MODULES_RE)?.[1]?.replace(/\/$/, ''),
      dirs.root.match(PNPM_NODE_MODULES_RE)?.[1]?.replace(/\/$/, ''),
    ]
    for (const dir of paths) {
      if (dir) {
        excludePaths.push(escapeRE(dir))
      }
    }
  }

  const layerPublicAssetsDirs: Array<{ dir: string, maxAge: number }> = []
  for (const dirs of layerDirs) {
    if (existsSync(dirs.public)) {
      layerPublicAssetsDirs.push({ dir: dirs.public, maxAge: 0 })
    }
  }

  const excludePattern = excludePaths.length
    ? [new RegExp(`node_modules\\/(?!${excludePaths.join('|')})`)]
    : [/node_modules/]

  const rootDirWithSlash = withTrailingSlash(nuxt.options.rootDir)

  const moduleEntryPaths: string[] = []
  for (const m of nuxt.options._installedModules) {
    const path = m.meta?.rawPath || m.entryPath
    if (path) {
      moduleEntryPaths.push(getDirectory(path))
    }
  }

  const modules = await resolveNuxtModule(rootDirWithSlash, moduleEntryPaths)

  addTemplate(nitroSchemaTemplate)

  const sharedDirs = new Set<string>()
  if (nuxt.options.nitro.imports !== false && nuxt.options.imports.scan !== false) {
    for (const layer of nuxt.options._layers) {
      // Layer disabled scanning for itself
      if (layer.config?.imports?.scan === false) {
        continue
      }

      sharedDirs.add(resolve(layer.config.rootDir, layer.config.dir?.shared ?? 'shared', 'utils'))
      sharedDirs.add(resolve(layer.config.rootDir, layer.config.dir?.shared ?? 'shared', 'types'))
    }
  }

  // Resolve aliases in user-provided input - so `~/server/test` will work
  nuxt.options.nitro.plugins ||= []
  nuxt.options.nitro.plugins = nuxt.options.nitro.plugins.map(plugin => plugin ? resolveAlias(plugin, nuxt.options.alias) : plugin)

  if (nuxt.options.dev && nuxt.options.features.devLogs) {
    addPlugin(resolve(nuxt.options.appDir, 'plugins/dev-server-logs'))
    nuxt.options.nitro.plugins.push(resolve(distDir, 'runtime/plugins/dev-server-logs'))
    nuxt.options.nitro.virtual = defu(nuxt.options.nitro.virtual, {
      '#internal/dev-server-logs-options': () => `export const rootDir = ${JSON.stringify(nuxt.options.rootDir)};`,
    })
  }

  if (nuxt.options.experimental.componentIslands) {
    // sync conditions with /packages/nuxt/src/core/templates.ts#L539
    nuxt.options.nitro.virtual ||= {}
    const ISLAND_RENDERER_KEY = '#internal/nuxt/island-renderer.mjs'
    nuxt.options.nitro.virtual[ISLAND_RENDERER_KEY] = () => {
      if (nuxt.options.dev || nuxt.options.experimental.componentIslands !== 'auto' || nuxt.apps.default?.pages?.some(p => p.mode === 'server') || nuxt.apps.default?.components?.some(c => c.mode === 'server' && !nuxt.apps.default?.components.some(other => other.pascalName === c.pascalName && other.mode === 'client'))) {
        return `export { default } from '${resolve(distDir, 'runtime/handlers/island')}'`
      }
      return `import { defineEventHandler } from 'nitro/h3'; export default defineEventHandler(() => {});`
    }
    nuxt.options.nitro.handlers ||= []
    nuxt.options.nitro.handlers.push({
      route: '/__nuxt_island/**',
      handler: ISLAND_RENDERER_KEY,
    })

    if (!nuxt.options.ssr && nuxt.options.experimental.componentIslands !== 'auto') {
      nuxt.options.ssr = true
      nuxt.options.nitro.routeRules ||= {}
      nuxt.options.nitro.routeRules['/**'] = defu(nuxt.options.nitro.routeRules['/**'], { ssr: false })
    }
  }

  const mockProxy = resolveModulePath('mocked-exports/proxy', { from: import.meta.url })
  const { version: nuxtVersion } = await readPackageJSON('nuxt', { from: import.meta.url })

  const nitroConfig: NitroConfig = defu(nuxt.options.nitro, {
    debug: nuxt.options.debug ? nuxt.options.debug.nitro : false,
    rootDir: nuxt.options.rootDir,
    workspaceDir: nuxt.options.workspaceDir,
    builder: 'rollup',
    serverDir: nuxt.options.serverDir,
    dev: nuxt.options.dev,
    buildDir: nuxt.options.buildDir,
    experimental: {
      tsconfigPaths: false,
      asyncContext: nuxt.options.experimental.asyncContext,
      typescriptBundlerResolution: nuxt.options.future.typescriptBundlerResolution || nuxt.options.typescript?.tsConfig?.compilerOptions?.moduleResolution?.toLowerCase() === 'bundler' || nuxt.options.nitro.typescript?.tsConfig?.compilerOptions?.moduleResolution?.toLowerCase() === 'bundler',
    },
    framework: {
      name: 'nuxt',
      version: nuxtVersion || nitroBuilder.version,
    },
    imports: {
      autoImport: nuxt.options.imports.autoImport as boolean,
      dirs: [...sharedDirs],
      presets: nuxt.options.experimental.nitroAutoImports
        ? [
            ...v2ImportsPreset,
            await getH3ImportsPreset(),
          ]
        : [],
      imports: [
        {
          as: '__buildAssetsURL',
          name: 'buildAssetsURL',
          from: resolve(distDir, 'runtime/utils/paths'),
        },
        {
          as: '__publicAssetsURL',
          name: 'publicAssetsURL',
          from: resolve(distDir, 'runtime/utils/paths'),
        },
        {
          // TODO: Remove after https://github.com/nitrojs/nitro/issues/1049
          as: 'defineAppConfig',
          name: 'defineAppConfig',
          from: resolve(distDir, 'runtime/utils/config'),
          priority: -1,
        },
      ],
      exclude: [...excludePattern, /[\\/]\.git[\\/]/],
    },
    // TODO: support for bundle analyser: https://github.com/nitrojs/nitro/pull/3628
    scanDirs: layerDirs.map(dirs => dirs.server),
    renderer: {
      handler: resolve(distDir, 'runtime/handlers/renderer'),
    },
    handlers: [
      ...nuxt.options.experimental.runtimeBaseURL
        ? [{
            route: '',
            middleware: true,
            handler: resolve(distDir, 'runtime/middleware/base-url'),
          }]
        : [],
      ...nuxt.options.serverHandlers,
    ],
    devHandlers: [],
    baseURL: nuxt.options.app.baseURL,
    virtual: {
      '#internal/nuxt.config.mjs': () => nuxt.vfs['#build/nuxt.config.mjs'] || '',
      '#internal/nuxt/app-config': () => nuxt.vfs['#build/app.config.mjs']?.replace(/\/\*\* client \*\*\/[\s\S]*\/\*\* client-end \*\*\//, '') || '',
      '#spa-template': async () => `export const template = ${JSON.stringify(await spaLoadingTemplate(nuxt))}`,
      // this will be overridden in vite plugin
      '#internal/entry-chunk.mjs': () => `export const entryFileName = undefined`,
      '#internal/nuxt/entry-ids.mjs': () => `export default []`,
      '#internal/nuxt/nitro-config.mjs': () => {
        const hasCachedRoutes = nitro.routing.routeRules.routes.some(r => r.data.isr || r.data.cache)
        return [
          `export const NUXT_NO_SSR = ${nuxt.options.ssr === false}`,
          `export const NUXT_EARLY_HINTS = ${nuxt.options.experimental.writeEarlyHints !== false}`,
          `export const NUXT_NO_SCRIPTS = ${nuxt.options.features.noScripts === 'all' || (!!nuxt.options.features.noScripts && !nuxt.options.dev)}`,
          `export const NUXT_INLINE_STYLES = ${!!nuxt.options.features.inlineStyles}`,
          `export const PARSE_ERROR_DATA = ${!!nuxt.options.experimental.parseErrorData}`,
          `export const NUXT_JSON_PAYLOADS = ${!!nuxt.options.experimental.renderJsonPayloads}`,
          `export const NUXT_ASYNC_CONTEXT = ${!!nuxt.options.experimental.asyncContext}`,
          `export const NUXT_SHARED_DATA = ${!!nuxt.options.experimental.sharedPrerenderData}`,
          `export const NUXT_PAYLOAD_EXTRACTION = ${!!nuxt.options.experimental.payloadExtraction}`,
          `export const NUXT_RUNTIME_PAYLOAD_EXTRACTION = ${hasCachedRoutes}`,
        ].join('\n')
      },
    },
    routeRules: {
      '/**': { ssr: true },
      '/__nuxt_error': { cache: false },
    },
    typescript: {
      strict: true,
      generateTsConfig: true,
      tsconfigPath: join(nuxt.options.buildDir, 'tsconfig.server.json'),
      generatedTypesDir: join(nuxt.options.buildDir, 'types/nitro'),
      tsConfig: {
        compilerOptions: {
          lib: ['esnext', 'webworker', 'dom.iterable'],
          skipLibCheck: true,
          noUncheckedIndexedAccess: true,
        },
        include: [
          join(nuxt.options.buildDir, 'types/nitro-nuxt.d.ts'),
          ...modules.flatMap((m) => {
            const moduleDir = relativeWithDot(nuxt.options.buildDir, m)
            return [
              join(moduleDir, 'runtime/server'),
              join(moduleDir, 'dist/runtime/server'),
            ]
          }),
          ...layerDirs.map(dirs => relativeWithDot(nuxt.options.buildDir, join(dirs.server, '**/*'))),
          ...layerDirs.map(dirs => relativeWithDot(nuxt.options.buildDir, join(dirs.shared, '**/*.d.ts'))),
        ],
        exclude: [
          ...nuxt.options.modulesDir.map(m => relativeWithDot(nuxt.options.buildDir, m)),
          relativeWithDot(nuxt.options.buildDir, resolve(nuxt.options.rootDir, 'dist')),
        ],
      },
    },
    publicAssets: [
      nuxt.options.dev
        ? {
            dir: resolve(nuxt.options.buildDir, 'dist/client'),
            maxAge: 0,
          }
        : {
            dir: join(nuxt.options.buildDir, 'dist/client', nuxt.options.app.buildAssetsDir),
            maxAge: 31536000 /* 1 year */,
            baseURL: nuxt.options.app.buildAssetsDir,
          },
      ...layerPublicAssetsDirs,
    ],
    prerender: {
      ignoreUnprefixedPublicAssets: true,
      failOnError: true,
      concurrency: cpus().length * 4 || 4,
      routes: ([] as string[])
        // @ts-expect-error TODO: remove in nuxt v5
        .concat(nuxt.options.generate.routes),
    },
    sourcemap: !!nuxt.options.sourcemap.server,
    traceDeps: [
      // force include files used in generated code from the runtime-compiler
      ...(nuxt.options.vue.runtimeCompiler && !nuxt.options.experimental.externalVue)
        ? [
            ...nuxt.options.modulesDir.reduce<string[]>((targets, path) => {
              const serverRendererPath = resolve(path, 'vue/server-renderer/index.js')
              if (existsSync(serverRendererPath)) { targets.push(serverRendererPath) }
              return targets
            }, []),
          ]
        : [],
    ],
    noExternals: [
      ...(nuxt.options.dev
        ? []
        : [
            ...nuxt.options.experimental.externalVue ? [] : ['vue', '@vue/'],
            '@nuxt/',
            nuxt.options.buildDir,
          ]),
      ...nuxt.options.build.transpile.filter((i): i is string => typeof i === 'string'),
      'nuxt/dist',
      'nuxt3/dist',
      'nuxt-nightly/dist',
      distDir,
      // Ensure app config files have auto-imports injected even if they are pure .js files
      ...layerDirs.map(dirs => join(dirs.app, 'app.config')),

    ],
    alias: {
      // Vue 3 mocks
      ...nuxt.options.vue.runtimeCompiler || nuxt.options.experimental.externalVue
        ? {}
        : {
            'estree-walker': mockProxy,
            '@babel/parser': mockProxy,
            '@vue/compiler-core': mockProxy,
            '@vue/compiler-dom': mockProxy,
            '@vue/compiler-ssr': mockProxy,
          },
      '@vue/devtools-api': 'vue-devtools-stub',

      // Nuxt aliases
      ...nuxt.options.alias,

      // Paths
      '#internal/nuxt/paths': resolve(distDir, 'runtime/utils/paths'),
    },
    replace: {
      '__VUE_PROD_DEVTOOLS__': String(false),
    },
    rollupConfig: {
      output: {
        generatedCode: {
          symbols: true, // temporary fix for https://github.com/vuejs/core/issues/8351
        },
      },
      plugins: [],
    },
    logLevel: logLevelMapReverse[nuxt.options.logLevel],
  } satisfies NitroConfig)

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  if (nuxt.options.experimental.serverAppConfig === true && nitroConfig.imports) {
    nitroConfig.imports.imports ||= []
    nitroConfig.imports.imports.push({
      name: 'useAppConfig',
      from: resolve(distDir, 'runtime/utils/app-config'),
      priority: -1,
    })
  }

  // add error handler
  if (!nitroConfig.errorHandler && (nuxt.options.dev || !nuxt.options.experimental.noVueServer)) {
    nitroConfig.errorHandler = resolve(distDir, 'runtime/handlers/error')
  }

  // Resolve user-provided paths
  nitroConfig.serverDir = resolve(nuxt.options.rootDir, nuxt.options.srcDir, nitroConfig.serverDir as string)
  nitroConfig.ignore ||= []
  nitroConfig.ignore.push(
    ...resolveIgnorePatterns(nitroConfig.serverDir),
    `!${join(nuxt.options.buildDir, 'dist/client', nuxt.options.app.buildAssetsDir, '**/*')}`,
  )

  const validManifestKeys = ['prerender', 'redirect', 'appMiddleware', 'appLayout']

  addTemplate({
    filename: 'route-rules.mjs',
    getContents () {
      if (!nuxt._nitro) {
        return `export default () => ({})`
      }
      const matcher = nuxt._nitro.routing.routeRules.compileToString({
        matchAll: true,
        serialize (routeRules) {
          return `{${Object.entries(routeRules)
            .filter(([name, value]) => value !== undefined && validManifestKeys.includes(name))
            .map(([name, value]) => {
              if (name === 'redirect') {
                const redirectOptions = value as NitroRouteRules['redirect']
                value = typeof redirectOptions === 'string' ? redirectOptions : redirectOptions!.to
              }
              if (name === 'appMiddleware') {
                const appMiddlewareOptions = value as NitroRouteRules['appMiddleware']
                if (typeof appMiddlewareOptions === 'string') {
                  value = { [appMiddlewareOptions]: true }
                } else if (Array.isArray(appMiddlewareOptions)) {
                  const normalizedRules: Record<string, boolean> = {}
                  for (const middleware of appMiddlewareOptions) {
                    normalizedRules[middleware] = true
                  }
                  value = normalizedRules
                }
              }
              if (name === 'cache' || name === 'isr') {
                name = 'payload'
                value = Boolean(value)
              }
              return `${name}: ${JSON.stringify(value)}`
            }).join(',')
          }}`
        },
      })
      return `
      import { defu } from 'defu'
      const matcher = ${matcher}
      export default (path) => defu({}, ...matcher('', path).map(r => r.data).reverse())
      `
    },
  })

  if (nuxt.options.experimental.payloadExtraction) {
    if (nuxt.options.dev) {
      nuxt.hook('nitro:config', (nitroConfig) => {
        nitroConfig.prerender ||= {}
        nitroConfig.prerender.routes ||= []
        nitroConfig.routeRules ||= {}
        for (const route of nitroConfig.prerender.routes) {
          if (!route) { continue }
          nitroConfig.routeRules[route] = defu(nitroConfig.routeRules[route], { prerender: true })
        }
      })
    }
    nuxt.hook('nitro:init', (nitro) => {
      nitro.hooks.hook('build:before', async (nitro) => {
        const updatedRules: Record<string, Record<string, any>> = {}
        for (const { route, data: value } of nitro.routing.routeRules.routes) {
          if (!route.endsWith('*') && !route.endsWith('/_payload.json')) {
            if ((value.isr || value.cache) || (value.prerender && nuxt.options.dev)) {
              const payloadKey = route + '/_payload.json'
              const defaults = {} as Record<string, any>
              for (const key of ['isr', 'cache', ...nuxt.options.dev ? ['prerender'] : []]) {
                if (key in value) {
                  defaults[key] = value[key as keyof typeof value]
                }
              }
              updatedRules[payloadKey] = defu(nitro.options.routeRules[payloadKey], defaults)
            }
          }
        }
        await nitro.updateConfig({ routeRules: { ...nitro.options.routeRules, ...updatedRules } })
        nitro.routing.sync()
      })
    })
  }

  // Add app manifest handler and prerender configuration
  if (nuxt.options.experimental.appManifest) {
    const buildId = nuxt.options.runtimeConfig.app.buildId ||= nuxt.options.buildId
    const buildTimestamp = Date.now()

    const manifestPrefix = joinURL(nuxt.options.app.buildAssetsDir, 'builds')
    const tempDir = join(nuxt.options.buildDir, 'manifest')

    nitroConfig.prerender ||= {}
    nitroConfig.prerender.ignore ||= []
    nitroConfig.prerender.ignore.push(joinURL(nuxt.options.app.baseURL, manifestPrefix))

    nitroConfig.publicAssets!.unshift(
      // build manifest
      {
        dir: join(tempDir, 'meta'),
        maxAge: 31536000 /* 1 year */,
        baseURL: joinURL(manifestPrefix, 'meta'),
      },
      // latest build
      {
        dir: tempDir,
        maxAge: 1,
        baseURL: manifestPrefix,
      },
    )

    nuxt.options.alias['#app-manifest'] = join(tempDir, `meta/${buildId}.json`)

    // write stub manifest before build so external import of #app-manifest can be resolved
    if (!nuxt.options.dev) {
      nuxt.hook('build:before', async () => {
        await fsp.mkdir(join(tempDir, 'meta'), { recursive: true })
        await fsp.writeFile(join(tempDir, `meta/${buildId}.json`), JSON.stringify({}))
      })
    }

    nuxt.hook('nitro:config', (config) => {
      config.alias ||= {}
      config.alias['#app-manifest'] = join(tempDir, `meta/${buildId}.json`)
    })

    nuxt.hook('nitro:init', (nitro) => {
      nitro.hooks.hook('rollup:before', async (nitro) => {
        // Add pages prerendered but not covered by route rules
        const prerenderedRoutes = new Set<string>()
        if (nitro._prerenderedRoutes?.length) {
          const payloadSuffix = nuxt.options.experimental.renderJsonPayloads ? '/_payload.json' : '/_payload.js'
          for (const route of nitro._prerenderedRoutes) {
            if (!route.error && route.route.endsWith(payloadSuffix)) {
              const url = route.route.slice(0, -payloadSuffix.length) || '/'
              const rules = defu({}, ...nitro.routing.routeRules.matchAll('', url).reverse()) as Record<string, any>
              if (!rules.prerender) {
                prerenderedRoutes.add(url)
              }
            }
          }
        }

        const manifest = {
          id: buildId,
          timestamp: buildTimestamp,
          prerendered: nuxt.options.dev ? [] : [...prerenderedRoutes],
        }

        await fsp.mkdir(join(tempDir, 'meta'), { recursive: true })
        await fsp.writeFile(join(tempDir, 'latest.json'), JSON.stringify({
          id: buildId,
          timestamp: buildTimestamp,
        }))
        await fsp.writeFile(join(tempDir, `meta/${buildId}.json`), JSON.stringify(manifest))
      })
    })
  }

  // add stub alias to allow vite to resolve import
  if (!nuxt.options.experimental.appManifest) {
    nuxt.options.alias['#app-manifest'] = mockProxy
  }

  // Add fallback server for `ssr: false`
  const FORWARD_SLASH_RE = /\//g
  if (!nuxt.options.ssr) {
    nitroConfig.virtual!['#build/dist/server/server.mjs'] = 'export default () => {}'
    // In case a non-normalized absolute path is called for on Windows
    if (process.platform === 'win32') {
      nitroConfig.virtual!['#build/dist/server/server.mjs'.replace(FORWARD_SLASH_RE, '\\')] = 'export default () => {}'
    }
  }

  if (nuxt.options.dev) {
    nitroConfig.virtual!['#build/dist/server/styles.mjs'] = 'export default {}'
    // In case a non-normalized absolute path is called for on Windows
    if (process.platform === 'win32') {
      nitroConfig.virtual!['#build/dist/server/styles.mjs'.replace(FORWARD_SLASH_RE, '\\')] = 'export default {}'
    }
  }

  // Register nuxt protection patterns
  nitroConfig.rollupConfig!.plugins = await nitroConfig.rollupConfig!.plugins || []
  nitroConfig.rollupConfig!.plugins = toArray(nitroConfig.rollupConfig!.plugins)

  const sharedDir = withTrailingSlash(resolve(nuxt.options.rootDir, nuxt.options.dir.shared))
  const relativeSharedDir = withTrailingSlash(relative(nuxt.options.rootDir, resolve(nuxt.options.rootDir, nuxt.options.dir.shared)))
  const sharedPatterns = [/^#shared\//, new RegExp('^' + escapeRE(sharedDir)), new RegExp('^' + escapeRE(relativeSharedDir))]
  nitroConfig.rollupConfig!.plugins!.push(
    ImpoundPlugin.rollup({
      cwd: nuxt.options.rootDir,
      include: sharedPatterns,
      patterns: createImportProtectionPatterns(nuxt, { context: 'shared' }),
    }),
    ImpoundPlugin.rollup({
      cwd: nuxt.options.rootDir,
      patterns: createImportProtectionPatterns(nuxt, { context: 'nitro-app' }),
      exclude: [/node_modules[\\/]nitro(?:pack)?(?:-nightly)?[\\/]|(packages|@nuxt)[\\/]nitro-server(?:-nightly)?[\\/](src|dist)[\\/]runtime[\\/]/, ...sharedPatterns],
    }),
  )

  // Apply Nuxt's ignore configuration to the root and src unstorage mounts
  // created by Nitro. This ensures that the unstorage watcher will use the
  // same ignore list as Nuxt's watcher and can reduce unnecessary file handles.
  const isIgnored = createIsIgnored(nuxt)
  nitroConfig.devStorage ??= {}
  nitroConfig.devStorage.root ??= {
    driver: 'fs',
    readOnly: true,
    base: nitroConfig.rootDir,
    watchOptions: {
      ignored: [isIgnored],
    },
  }
  nitroConfig.devStorage.src ??= {
    driver: 'fs',
    readOnly: true,
    base: nitroConfig.serverDir,
    watchOptions: {
      ignored: [isIgnored],
    },
  }

  // Hoist types for nitro implicit dependencies
  nuxt.options.typescript.hoist.push(
    // Nitro auto-imported/augmented dependencies
    'nitro',
    'nitro/app',
    'nitro/builder',
    'nitro/cache',
    'nitro/config',
    'nitro/context',
    'nitro/database',
    'nitro/h3',
    'nitro/meta',
    'nitro/runtime-config',
    'nitro/storage',
    'nitro/task',
    'nitro/types',
    // TODO: remove in v5
    'nitropack/types',
    'nitropack/runtime',
    'nitropack',
    'srvx',
    'defu',
    'h3',
    'consola',
    'ofetch',
    'crossws',
  )

  // Extend nitro config with hook
  await nuxt.callHook('nitro:config', nitroConfig)

  if (nitroConfig.static && nuxt.options.dev) {
    nitroConfig.routeRules ||= {}
    nitroConfig.routeRules['/**'] = defu(nitroConfig.routeRules['/**'], { prerender: true })
  }

  // TODO: extract to shared utility?
  const excludedAlias = [/^@vue\/.*$/, 'vue', /vue-router/, 'vite/client', '#imports', 'vue-demi', /^#app/, '~', '@', '~~', '@@']
  const basePath = nitroConfig.typescript!.tsConfig!.compilerOptions?.baseUrl ? resolve(nuxt.options.buildDir, nitroConfig.typescript!.tsConfig!.compilerOptions?.baseUrl) : nuxt.options.buildDir
  const aliases = nitroConfig.alias!
  const tsConfig = nitroConfig.typescript!.tsConfig!
  tsConfig.compilerOptions ||= {}
  tsConfig.compilerOptions.paths ||= {}
  for (const _alias in aliases) {
    const alias = _alias as keyof typeof aliases
    if (excludedAlias.some(pattern => typeof pattern === 'string' ? alias === pattern : pattern.test(alias))) {
      continue
    }
    if (alias in tsConfig.compilerOptions.paths) {
      continue
    }

    const absolutePath = resolve(basePath, aliases[alias]!)
    const isDirectory = aliases[alias]!.endsWith('/') || await fsp.stat(absolutePath).then(r => r.isDirectory()).catch(() => null /* file does not exist */)
    // note - nitro will check + remove the file extension as required
    tsConfig.compilerOptions.paths[alias] = [absolutePath]
    if (isDirectory) {
      tsConfig.compilerOptions.paths[`${alias}/*`] = [`${absolutePath}/*`]
    }
  }

  // Init nitro
  const nitro = await createNitro(nitroConfig, {
    compatibilityDate: nuxt.options.compatibilityDate,
    dotenv: nuxt.options._loadOptions?.dotenv,
  })

  // TODO: remove when devtools gains support for nitro v3
  // @ts-expect-error devtools calls storage.watch()
  nitro.storage ||= { watch: () => {} }

  // TODO: remove when app manifest support is landed in https://github.com/nuxt/nuxt/pull/21641
  // Add prerender payload support
  if (nitro.options.static && nuxt.options.experimental.payloadExtraction === undefined) {
    logger.warn('Using experimental payload extraction for full-static output. You can opt-out by setting `experimental.payloadExtraction` to `false`.')
    nuxt.options.experimental.payloadExtraction = true
  }

  // Trigger Nitro reload when SPA loading template changes
  const spaLoadingTemplateFilePath = await spaLoadingTemplatePath(nuxt)
  nuxt.hook('builder:watch', async (_event, relativePath) => {
    const path = resolve(nuxt.options.srcDir, relativePath)
    if (path === spaLoadingTemplateFilePath) {
      await nitro.hooks.callHook('rollup:reload')
    }
  })

  const cacheDir = resolve(nuxt.options.buildDir, 'cache/nitro/prerender')
  const cacheDriverPath = join(distDir, 'runtime/utils/cache-driver.js')
  await fsp.rm(cacheDir, { recursive: true, force: true }).catch(() => {})
  nitro.options._config.storage = defu(nitro.options._config.storage, {
    'internal:nuxt:prerender': {
      // TODO: resolve upstream where file URLs are not being resolved/inlined correctly
      driver: isWindows ? pathToFileURL(cacheDriverPath).href : cacheDriverPath,
      base: cacheDir,
    },
  })

  // Expose nitro to modules and kit
  nuxt._nitro = nitro
  await nuxt.callHook('nitro:init', nitro)

  // Connect vfs storages
  const nitroVfs = nitro.vfs
  nitro.vfs = new Proxy(nitroVfs, {
    get (target, prop: string) {
      return Reflect.get(target, prop) || { render: () => nuxt.vfs[prop] }
    },
    set (target, prop: string, value) {
      return Reflect.set(target, prop, value)
    },
  })

  // Connect hooks
  nuxt.hook('close', () => nitro.hooks.callHook('close'))
  nitro.hooks.hook('prerender:routes', (routes) => {
    return nuxt.callHook('prerender:routes', { routes })
  })

  // Enable runtime compiler client side
  if (nuxt.options.vue.runtimeCompiler) {
    addVitePlugin({
      name: 'nuxt:vue:runtime-compiler',
      applyToEnvironment: environment => environment.name === 'client',
      enforce: 'pre',
      resolveId (id, importer) {
        if (id === 'vue') {
          return this.resolve('vue/dist/vue.esm-bundler', importer, { skipSelf: true })
        }
      },
    })
    for (const hook of ['webpack:config', 'rspack:config'] as const) {
      nuxt.hook(hook, (configuration) => {
        const clientConfig = configuration.find(config => config.name === 'client')
        if (!clientConfig!.resolve) { clientConfig!.resolve!.alias = {} }
        if (Array.isArray(clientConfig!.resolve!.alias)) {
          clientConfig!.resolve!.alias.push({
            name: 'vue',
            alias: 'vue/dist/vue.esm-bundler',
          })
        } else {
          clientConfig!.resolve!.alias!.vue = 'vue/dist/vue.esm-bundler'
        }
      })
    }
  }

  // Setup handlers
  const devMiddlewareHandler = dynamicEventHandler()
  nitro.options.devHandlers.unshift({ route: '', handler: devMiddlewareHandler })
  nitro.options.devHandlers.push(...nuxt.options.devServerHandlers)
  nitro.options.handlers.unshift({
    route: '/__nuxt_error',
    lazy: true,
    handler: resolve(distDir, 'runtime/handlers/renderer'),
  })

  // TODO: refactor into a module when this is more full-featured
  // add Chrome devtools integration
  if (nuxt.options.experimental.chromeDevtoolsProjectSettings) {
    const cacheDir = resolve(nuxt.options.rootDir, 'node_modules/.cache/nuxt')
    let projectConfiguration = await readFile(join(cacheDir, 'chrome-workspace.json'), 'utf-8')
      .then(r => JSON.parse(r))
      .catch(() => null)

    if (!projectConfiguration) {
      projectConfiguration = { uuid: randomUUID() }
      await mkdir(cacheDir, { recursive: true })
      await writeFile(join(cacheDir, 'chrome-workspace.json'), JSON.stringify(projectConfiguration), 'utf-8')
    }

    nitro.options.devHandlers.push({
      route: '/.well-known/appspecific/com.chrome.devtools.json',
      handler: defineEventHandler(() => ({
        workspace: {
          ...projectConfiguration,
          root: nuxt.options.rootDir,
        },
      })),
    })
  }

  if (!nuxt.options.dev && nuxt.options.experimental.noVueServer) {
    nitro.hooks.hook('rollup:before', (nitro) => {
      if (nitro.options.preset === 'nitro-prerender') {
        nitro.options.errorHandler = resolve(distDir, 'runtime/handlers/error')
        return
      }
      const nuxtErrorHandler = nitro.options.handlers.findIndex(h => h.route === '/__nuxt_error')
      if (nuxtErrorHandler >= 0) {
        nitro.options.handlers.splice(nuxtErrorHandler, 1)
      }

      nitro.options.renderer = undefined
    })
  }

  // ensure Nitro types only apply to server directory and not the whole root directory
  nitro.hooks.hook('types:extend', (types) => {
    types.tsConfig ||= {}
    const rootDirGlob = relativeWithDot(nuxt.options.buildDir, join(nuxt.options.rootDir, '**/*'))
    types.tsConfig.include = types.tsConfig.include?.filter(i => i !== rootDirGlob)
  })

  // Add typed route responses
  nuxt.hook('prepare:types', async (opts) => {
    if (!nuxt.options.dev) {
      await writeTypes(nitro)
    }
    // Exclude nitro output dir from typescript
    opts.tsConfig.exclude ||= []
    opts.tsConfig.exclude.push(relative(nuxt.options.buildDir, resolve(nuxt.options.rootDir, nitro.options.output.dir)))
    opts.tsConfig.exclude.push(relative(nuxt.options.buildDir, resolve(nuxt.options.rootDir, nuxt.options.serverDir)))
    opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/nitro.d.ts') })

    // ensure aliases shared between nuxt + nitro are included in shared tsconfig
    opts.sharedTsConfig.compilerOptions ||= {}
    opts.sharedTsConfig.compilerOptions.paths ||= {}
    for (const key in nuxt.options.alias) {
      if (nitro.options.alias[key] && nitro.options.alias[key] === nuxt.options.alias[key]) {
        const dirKey = join(key, '*')
        if (opts.tsConfig.compilerOptions?.paths[key]) {
          opts.sharedTsConfig.compilerOptions.paths[key] = opts.tsConfig.compilerOptions.paths[key]
        }
        if (opts.tsConfig.compilerOptions?.paths[dirKey]) {
          opts.sharedTsConfig.compilerOptions.paths[dirKey] = opts.tsConfig.compilerOptions.paths[dirKey]
        }
      }
    }
  })

  if (nitro.options.static) {
    nitro.hooks.hook('prerender:routes', (routes) => {
      for (const route of ['/200.html', '/404.html']) {
        routes.add(route)
      }
      if (!nuxt.options.ssr) {
        routes.add('/index.html')
      }
    })
  }

  // Copy public assets after prerender so app manifest can be present
  if (!nuxt.options.dev) {
    nitro.hooks.hook('rollup:before', async (nitro) => {
      await copyPublicAssets(nitro)
      await nuxt.callHook('nitro:build:public-assets', nitro)
    })
  }

  async function symlinkDist () {
    if (nitro.options.static) {
      const distDir = resolve(nuxt.options.rootDir, 'dist')
      if (!existsSync(distDir)) {
        await fsp.symlink(nitro.options.output.publicDir, distDir, 'junction').catch(() => {})
      }
    }
  }

  // nuxt build/dev
  nuxt.hook('build:done', async () => {
    await nuxt.callHook('nitro:build:before', nitro)
    await prepare(nitro)
    if (nuxt.options.dev) {
      return build(nitro)
    }

    await prerender(nitro)

    logger.restoreAll()
    await build(nitro)
    logger.wrapAll()

    await symlinkDist()
  })

  // nuxt dev
  if (nuxt.options.dev) {
    for (const builder of ['webpack', 'rspack'] as const) {
      nuxt.hook(`${builder}:compile`, ({ name, compiler }) => {
        if (name === 'server') {
          const memfs = compiler.outputFileSystem as typeof import('node:fs')
          nitro.options.virtual['#build/dist/server/server.mjs'] = () => memfs.readFileSync(join(nuxt.options.buildDir, 'dist/server/server.mjs'), 'utf-8')
        }
      })
      nuxt.hook(`${builder}:compiled`, () => { nuxt.server.reload() })
    }
    nuxt.hook('vite:compiled', () => { nuxt.server.reload() })

    nuxt.hook('server:devHandler', (h, options) => {
      devMiddlewareHandler.set(defineEventHandler((event) => {
        if (options.cors(event.url.pathname)) {
          const isPreflight = handleCors(event, nuxt.options.devServer.cors)
          if (isPreflight) {
            return null
          }
          event.res.headers.set('Vary', 'Origin')
        }
        return h(event)
      }))
    })
    nuxt.server = createDevServer(nitro)

    const waitUntilCompile = new Promise<void>(resolve => nitro.hooks.hook('compiled', () => resolve()))
    nuxt.hook('build:done', () => waitUntilCompile)
  }
}

const RELATIVE_RE = /^([^.])/
function relativeWithDot (from: string, to: string) {
  return relative(from, to).replace(RELATIVE_RE, './$1') || '.'
}

async function spaLoadingTemplatePath (nuxt: Nuxt) {
  if (typeof nuxt.options.spaLoadingTemplate === 'string') {
    return resolve(nuxt.options.srcDir, nuxt.options.spaLoadingTemplate)
  }

  const possiblePaths = nuxt.options._layers.map(layer => resolve(layer.config.srcDir, layer.config.dir?.app || 'app', 'spa-loading-template.html'))

  return await findPath(possiblePaths) ?? resolve(nuxt.options.srcDir, nuxt.options.dir?.app || 'app', 'spa-loading-template.html')
}

async function spaLoadingTemplate (nuxt: Nuxt) {
  if (nuxt.options.spaLoadingTemplate === false) { return '' }

  const spaLoadingTemplate = await spaLoadingTemplatePath(nuxt)

  try {
    if (existsSync(spaLoadingTemplate)) {
      return readFileSync(spaLoadingTemplate, 'utf-8').trim()
    }
  } catch {
    // fall through if we have issues reading the file
  }

  if (nuxt.options.spaLoadingTemplate === true) {
    return defaultSpaLoadingTemplate()
  }

  if (nuxt.options.spaLoadingTemplate) {
    logger.warn(`Could not load custom \`spaLoadingTemplate\` path as it does not exist: \`${nuxt.options.spaLoadingTemplate}\`.`)
  }

  return ''
}
