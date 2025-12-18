import { pathToFileURL } from 'node:url'
import { existsSync, promises as fsp, readFileSync } from 'node:fs'
import { cpus } from 'node:os'
import process from 'node:process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import type { Nuxt, NuxtOptions } from '@nuxt/schema'
import { join, relative, resolve } from 'pathe'
import { readPackageJSON } from 'pkg-types'
import { createRouter as createRadixRouter, exportMatcher, toRouteMatcher } from 'radix3'
import { joinURL, withTrailingSlash } from 'ufo'
import { build, copyPublicAssets, createDevServer, createNitro, prepare, prerender, scanHandlers, writeTypes } from 'nitropack'
import type { Nitro, NitroConfig, NitroOptions } from 'nitropack/types'
import { addPlugin, addTemplate, addVitePlugin, createIsIgnored, findPath, getDirectory, getLayerDirectories, logger, resolveAlias, resolveIgnorePatterns, resolveNuxtModule } from '@nuxt/kit'
import escapeRE from 'escape-string-regexp'
import { defu } from 'defu'
import { defineEventHandler, dynamicEventHandler } from 'h3'
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

  const layerPublicAssetsDirs: Array<{ dir: string }> = []
  for (const dirs of layerDirs) {
    if (existsSync(dirs.public)) {
      layerPublicAssetsDirs.push({ dir: dirs.public })
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
  const isNuxtV4 = nuxt.options.future?.compatibilityVersion === 4
  if (isNuxtV4 && (nuxt.options.nitro.imports !== false && nuxt.options.imports.scan !== false)) {
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
    nuxt.options.nitro.externals = defu(nuxt.options.nitro.externals, {
      inline: [/#internal\/dev-server-logs-options/],
    })
    nuxt.options.nitro.virtual = defu(nuxt.options.nitro.virtual, {
      '#internal/dev-server-logs-options': () => `export const rootDir = ${JSON.stringify(nuxt.options.rootDir)};`,
    })
  }

  if (nuxt.options.experimental.componentIslands) {
    // sync conditions with /packages/nuxt/src/core/templates.ts#L539
    nuxt.options.nitro.virtual ||= {}
    nuxt.options.nitro.virtual['#internal/nuxt/island-renderer.mjs'] = () => {
      if (nuxt.options.dev || nuxt.options.experimental.componentIslands !== 'auto' || nuxt.apps.default?.pages?.some(p => p.mode === 'server') || nuxt.apps.default?.components?.some(c => c.mode === 'server' && !nuxt.apps.default?.components.some(other => other.pascalName === c.pascalName && other.mode === 'client'))) {
        return `export { default } from '${resolve(distDir, 'runtime/handlers/island')}'`
      }
      return `import { defineEventHandler } from 'h3'; export default defineEventHandler(() => {});`
    }
    nuxt.options.nitro.handlers ||= []
    nuxt.options.nitro.handlers.push({
      route: '/__nuxt_island/**',
      handler: '#internal/nuxt/island-renderer.mjs',
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
    srcDir: nuxt.options.serverDir,
    dev: nuxt.options.dev,
    buildDir: nuxt.options.buildDir,
    experimental: {
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
    esbuild: {
      options: { exclude: excludePattern },
    },
    analyze: !nuxt.options.test && nuxt.options.build.analyze && (nuxt.options.build.analyze === true || nuxt.options.build.analyze.enabled)
      ? {
          template: 'treemap',
          projectRoot: nuxt.options.rootDir,
          filename: join(nuxt.options.analyzeDir, '{name}.html'),
        }
      : false,
    scanDirs: layerDirs.map(dirs => dirs.server),
    renderer: resolve(distDir, 'runtime/handlers/renderer'),
    errorHandler: resolve(distDir, 'runtime/handlers/error'),
    nodeModulesDirs: nuxt.options.modulesDir,
    handlers: nuxt.options.serverHandlers,
    devHandlers: [],
    baseURL: nuxt.options.app.baseURL,
    virtual: {
      '#internal/nuxt.config.mjs': () => nuxt.vfs['#build/nuxt.config.mjs'],
      '#spa-template': async () => `export const template = ${JSON.stringify(await spaLoadingTemplate(nuxt))}`,
      // this will be overridden in vite plugin
      '#internal/entry-chunk.mjs': () => `export const entryFileName = undefined`,
      '#internal/nuxt/entry-ids.mjs': () => `export default []`,
      '#internal/nuxt/nitro-config.mjs': () => [
        `export const NUXT_NO_SSR = ${nuxt.options.ssr === false}`,
        `export const NUXT_EARLY_HINTS = ${nuxt.options.experimental.writeEarlyHints !== false}`,
        `export const NUXT_NO_SCRIPTS = ${nuxt.options.features.noScripts === 'all' || (!!nuxt.options.features.noScripts && !nuxt.options.dev)}`,
        `export const NUXT_INLINE_STYLES = ${!!nuxt.options.features.inlineStyles}`,
        `export const PARSE_ERROR_DATA = ${!!nuxt.options.experimental.parseErrorData}`,
        `export const NUXT_JSON_PAYLOADS = ${!!nuxt.options.experimental.renderJsonPayloads}`,
        `export const NUXT_ASYNC_CONTEXT = ${!!nuxt.options.experimental.asyncContext}`,
        `export const NUXT_SHARED_DATA = ${!!nuxt.options.experimental.sharedPrerenderData}`,
        `export const NUXT_PAYLOAD_EXTRACTION = ${!!nuxt.options.experimental.payloadExtraction}`,
      ].join('\n'),
    },
    routeRules: {
      '/__nuxt_error': { cache: false },
    },
    appConfig: nuxt.options.appConfig,
    appConfigFiles: layerDirs.map(dirs => join(dirs.app, 'app.config')),
    typescript: {
      strict: true,
      generateTsConfig: true,
      tsconfigPath: 'tsconfig.server.json',
      tsConfig: {
        compilerOptions: {
          lib: ['esnext', 'webworker', 'dom.iterable'],
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
          // nitro generate output: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/core/nitro.ts#L186
          relativeWithDot(nuxt.options.buildDir, resolve(nuxt.options.rootDir, 'dist')),
        ],
      },
    },
    publicAssets: [
      nuxt.options.dev
        ? { dir: resolve(nuxt.options.buildDir, 'dist/client') }
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
      routes: ([] as string[]).concat(nuxt.options.generate.routes),
    },
    sourceMap: nuxt.options.sourcemap.server,
    externals: {
      inline: [
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
      traceInclude: [
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
    },
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
      'process.env.NUXT_NO_SSR': nuxt.options.ssr === false,
      'process.env.NUXT_EARLY_HINTS': nuxt.options.experimental.writeEarlyHints !== false,
      'process.env.NUXT_NO_SCRIPTS': String(nuxt.options.features.noScripts === 'all' || (!!nuxt.options.features.noScripts && !nuxt.options.dev)),
      'process.env.NUXT_INLINE_STYLES': !!nuxt.options.features.inlineStyles,
      'process.env.PARSE_ERROR_DATA': String(!!nuxt.options.experimental.parseErrorData),
      'process.env.NUXT_JSON_PAYLOADS': !!nuxt.options.experimental.renderJsonPayloads,
      'process.env.NUXT_ASYNC_CONTEXT': !!nuxt.options.experimental.asyncContext,
      'process.env.NUXT_SHARED_DATA': !!nuxt.options.experimental.sharedPrerenderData,
      'process.dev': nuxt.options.dev,
      '__VUE_PROD_DEVTOOLS__': false,
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

  // Resolve user-provided paths
  nitroConfig.srcDir = resolve(nuxt.options.rootDir, nuxt.options.srcDir, nitroConfig.srcDir!)
  nitroConfig.ignore ||= []
  nitroConfig.ignore.push(
    ...resolveIgnorePatterns(nitroConfig.srcDir),
    `!${join(nuxt.options.buildDir, 'dist/client', nuxt.options.app.buildAssetsDir, '**/*')}`,
  )

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

    if (nuxt.options.future.compatibilityVersion !== 4) {
      // TODO: remove in Nuxt v4
      nuxt.hook('nitro:config', (config) => {
        for (const value of Object.values(config.routeRules || {})) {
          if ('experimentalNoScripts' in value) {
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            value.noScripts = value.experimentalNoScripts
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            delete value.experimentalNoScripts
          }
        }
      })
    }

    nuxt.hook('nitro:config', (config) => {
      config.alias ||= {}
      config.alias['#app-manifest'] = join(tempDir, `meta/${buildId}.json`)

      const rules = config.routeRules
      for (const rule in rules) {
        if (!(rules[rule] as any).appMiddleware) { continue }
        const value = (rules[rule] as any).appMiddleware
        if (typeof value === 'string') {
          (rules[rule] as NitroOptions['routeRules']).appMiddleware = { [value]: true }
        } else if (Array.isArray(value)) {
          const normalizedRules: Record<string, boolean> = {}
          for (const middleware of value) {
            normalizedRules[middleware] = true
          }
          (rules[rule] as NitroOptions['routeRules']).appMiddleware = normalizedRules
        }
      }
    })

    nuxt.hook('nitro:init', (nitro) => {
      nitro.hooks.hook('rollup:before', async (nitro) => {
        const routeRules = {} as Record<string, any>
        const _routeRules = nitro.options.routeRules
        const validManifestKeys = new Set(['prerender', 'redirect', 'appMiddleware'])
        for (const key in _routeRules) {
          if (key === '/__nuxt_error') { continue }
          let hasRules = false
          const filteredRules = {} as Record<string, any>
          for (const routeKey in _routeRules[key]) {
            const value = (_routeRules as any)[key][routeKey]
            if (value && validManifestKeys.has(routeKey)) {
              if (routeKey === 'redirect') {
                filteredRules[routeKey] = typeof value === 'string' ? value : value.to
              } else {
                filteredRules[routeKey] = value
              }
              hasRules = true
            }
          }
          if (hasRules) {
            routeRules[key] = filteredRules
          }
        }

        // Add pages prerendered but not covered by route rules
        const prerenderedRoutes = new Set<string>()
        const routeRulesMatcher = toRouteMatcher(
          createRadixRouter({ routes: routeRules }),
        )
        if (nitro._prerenderedRoutes?.length) {
          const payloadSuffix = nuxt.options.experimental.renderJsonPayloads ? '/_payload.json' : '/_payload.js'
          for (const route of nitro._prerenderedRoutes) {
            if (!route.error && route.route.endsWith(payloadSuffix)) {
              const url = route.route.slice(0, -payloadSuffix.length) || '/'
              const rules = defu({}, ...routeRulesMatcher.matchAll(url).reverse()) as Record<string, any>
              if (!rules.prerender) {
                prerenderedRoutes.add(url)
              }
            }
          }
        }

        const manifest = {
          id: buildId,
          timestamp: buildTimestamp,
          matcher: exportMatcher(routeRulesMatcher),
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

  if (nuxt.options.dev || nuxt.options.builder === '@nuxt/webpack-builder' || nuxt.options.builder === '@nuxt/rspack-builder') {
    nitroConfig.virtual!['#build/dist/server/styles.mjs'] = 'export default {}'
    // In case a non-normalized absolute path is called for on Windows
    if (process.platform === 'win32') {
      nitroConfig.virtual!['#build/dist/server/styles.mjs'.replace(FORWARD_SLASH_RE, '\\')] = 'export default {}'
    }
  }

  // Add backward-compatible middleware to respect `x-nuxt-no-ssr` header
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  if (nuxt.options.experimental.respectNoSSRHeader) {
    nitroConfig.handlers ||= []
    nitroConfig.handlers.push({
      handler: resolve(distDir, 'runtime/middleware/no-ssr'),
      middleware: true,
    })
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
    base: nitroConfig.srcDir,
    watchOptions: {
      ignored: [isIgnored],
    },
  }

  // Extend nitro config with hook
  await nuxt.callHook('nitro:config', nitroConfig)

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
  nitro.vfs = nuxt.vfs = nitro.vfs || nuxt.vfs || {}

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
  nitro.options.devHandlers.unshift({ handler: devMiddlewareHandler })
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
      if (nitro.options.preset === 'nitro-prerender') { return }
      const nuxtErrorHandler = nitro.options.handlers.findIndex(h => h.route === '/__nuxt_error')
      if (nuxtErrorHandler >= 0) {
        nitro.options.handlers.splice(nuxtErrorHandler, 1)
      }

      nitro.options.renderer = undefined
      nitro.options.errorHandler = '#internal/nitro/error'
    })
  }

  // Add typed route responses
  nuxt.hook('prepare:types', async (opts) => {
    if (!nuxt.options.dev) {
      await scanHandlers(nitro)
      await writeTypes(nitro)
    }
    // Exclude nitro output dir from typescript
    opts.tsConfig.exclude ||= []
    opts.tsConfig.exclude.push(relative(nuxt.options.buildDir, resolve(nuxt.options.rootDir, nitro.options.output.dir)))
    opts.references.push({ path: resolve(nuxt.options.buildDir, 'types/nitro.d.ts') })
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

    nuxt.hook('server:devHandler', (h) => { devMiddlewareHandler.set(h) })
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
