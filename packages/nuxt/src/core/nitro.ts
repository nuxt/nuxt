import { pathToFileURL } from 'node:url'
import { existsSync, promises as fsp, readFileSync } from 'node:fs'
import { cpus } from 'node:os'
import { join, relative, resolve } from 'pathe'
import { createRouter as createRadixRouter, exportMatcher, toRouteMatcher } from 'radix3'
import { joinURL, withTrailingSlash } from 'ufo'
import { build, copyPublicAssets, createDevServer, createNitro, prepare, prerender, scanHandlers, writeTypes } from 'nitropack'
import type { Nitro, NitroConfig, NitroOptions } from 'nitropack'
import { findPath, logger, resolveIgnorePatterns, resolveNuxtModule, resolvePath } from '@nuxt/kit'
import escapeRE from 'escape-string-regexp'
import { defu } from 'defu'
import fsExtra from 'fs-extra'
import { dynamicEventHandler } from 'h3'
import { isWindows } from 'std-env'
import type { Nuxt, NuxtOptions } from 'nuxt/schema'
import { version as nuxtVersion } from '../../package.json'
import { distDir } from '../dirs'
import { toArray } from '../utils'
import { template as defaultSpaLoadingTemplate } from '../../../ui-templates/dist/templates/spa-loading-icon'
import { ImportProtectionPlugin, nuxtImportProtections } from './plugins/import-protection'

const logLevelMapReverse = {
  silent: 0,
  info: 3,
  verbose: 3,
} satisfies Record<NuxtOptions['logLevel'], NitroConfig['logLevel']>

export async function initNitro (nuxt: Nuxt & { _nitro?: Nitro }) {
  // Resolve config
  const excludePaths = nuxt.options._layers
    .flatMap(l => [
      l.cwd.match(/(?<=\/)node_modules\/(.+)$/)?.[1],
      l.cwd.match(/\.pnpm\/.+\/node_modules\/(.+)$/)?.[1],
    ])
    .filter((dir): dir is string => Boolean(dir))
    .map(dir => escapeRE(dir))
  const excludePattern = excludePaths.length
    ? new RegExp(`node_modules\\/(?!${excludePaths.join('|')})`)
    : /node_modules/

  const rootDirWithSlash = withTrailingSlash(nuxt.options.rootDir)

  const moduleEntries = []
  for (const m of nuxt.options._installedModules) {
    if (m.entryPath) {
      moduleEntries.push(m.entryPath)
    }
  }
  const modules = await resolveNuxtModule(rootDirWithSlash,
    moduleEntries,
  )
  const nuxtDistDir = resolve(nuxt.options.rootDir, 'dist')
  const scanDirs: string[] = []
  const assetDir: { dir: string }[] = []
  const configExternals: string[] = new Array(nuxt.options._layers.length)
  for (let i = 0; i < nuxt.options._layers.length; i++) {
    const layer = nuxt.options._layers[i]
    configExternals[i] = resolve(layer.config.srcDir, 'app.config')
    const assetsLayerDir = resolve(layer.config.srcDir, (layer.config.rootDir === nuxt.options.rootDir ? nuxt.options : layer.config).dir?.public || 'public')
    if (existsSync(assetsLayerDir)) {
      assetDir.push({ dir: assetsLayerDir })
    }
    const scanLayerDir = (layer.config.serverDir || layer.config.srcDir) && resolve(layer.cwd, layer.config.serverDir || resolve(layer.config.srcDir, 'server'))
    if (scanLayerDir) {
      scanDirs.push(scanLayerDir)
    }
  }
  const buildDir = nuxt.options.buildDir
  const moduleExclude: string[] = new Array(nuxt.options.modulesDir.length)
  const moduleTraceInclude: string[] = []
  for (let i = 0; i < nuxt.options.modulesDir.length; i++) {
    const m = nuxt.options.modulesDir[i]
    moduleExclude[i] = relativeWithDot(buildDir, m)
    const serverRendererPath = resolve(m, 'vue/server-renderer/index.js')
    if (existsSync(serverRendererPath)) { moduleTraceInclude.push(serverRendererPath) }
  }
  const nitroPaths = resolve(distDir, 'core/runtime/nitro/paths')
  const renderer = resolve(distDir, 'core/runtime/nitro/renderer')
  const nitroConfig: NitroConfig = defu(nuxt.options.nitro, {
    debug: nuxt.options.debug,
    rootDir: nuxt.options.rootDir,
    workspaceDir: nuxt.options.workspaceDir,
    srcDir: nuxt.options.serverDir,
    dev: nuxt.options.dev,
    buildDir,
    experimental: {
      asyncContext: nuxt.options.experimental.asyncContext,
      typescriptBundlerResolution: nuxt.options.future.typescriptBundlerResolution || nuxt.options.typescript?.tsConfig?.compilerOptions?.moduleResolution?.toLowerCase() === 'bundler' || nuxt.options.nitro.typescript?.tsConfig?.compilerOptions?.moduleResolution?.toLowerCase() === 'bundler',
    },
    framework: {
      name: 'nuxt',
      version: nuxtVersion,
    },
    imports: {
      autoImport: nuxt.options.imports.autoImport as boolean,
      imports: [
        {
          as: '__buildAssetsURL',
          name: 'buildAssetsURL',
          from: nitroPaths,
        },
        {
          as: '__publicAssetsURL',
          name: 'publicAssetsURL',
          from: nitroPaths,
        },
        {
          // TODO: Remove after https://github.com/unjs/nitro/issues/1049
          as: 'defineAppConfig',
          name: 'defineAppConfig',
          from: resolve(distDir, 'core/runtime/nitro/config'),
          priority: -1,
        },
      ],
      exclude: [excludePattern, /[\\/]\.git[\\/]/],
    },
    esbuild: {
      options: { exclude: [excludePattern] },
    },
    analyze: !nuxt.options.test && nuxt.options.build.analyze && (nuxt.options.build.analyze === true || nuxt.options.build.analyze.enabled)
      ? {
          template: 'treemap',
          projectRoot: nuxt.options.rootDir,
          filename: join(nuxt.options.analyzeDir, '{name}.html'),
        }
      : false,
    scanDirs,
    renderer,
    errorHandler: resolve(distDir, 'core/runtime/nitro/error'),
    nodeModulesDirs: nuxt.options.modulesDir,
    handlers: nuxt.options.serverHandlers,
    devHandlers: [],
    baseURL: nuxt.options.app.baseURL,
    virtual: {
      '#internal/nuxt.config.mjs': () => nuxt.vfs['#build/nuxt.config'],
      '#spa-template': async () => `export const template = ${JSON.stringify(await spaLoadingTemplate(nuxt))}`,
    },
    routeRules: {
      '/__nuxt_error': { cache: false },
    },
    appConfig: nuxt.options.appConfig,
    appConfigFiles: configExternals,
    typescript: {
      strict: true,
      generateTsConfig: true,
      tsconfigPath: 'tsconfig.server.json',
      tsConfig: {
        include: [
          join(buildDir, 'types/nitro-nuxt.d.ts'),
          ...modules.map(m => join(relativeWithDot(buildDir, m), 'runtime/server')),
        ],
        exclude: [
          ...moduleExclude,
          // nitro generate output: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/core/nitro.ts#L186
          relativeWithDot(buildDir, nuxtDistDir),
        ],
      },
    },
    publicAssets: [
      nuxt.options.dev
        ? { dir: resolve(buildDir, 'dist/client') }
        : {
            dir: join(buildDir, 'dist/client', nuxt.options.app.buildAssetsDir),
            maxAge: 31536000 /* 1 year */,
            baseURL: nuxt.options.app.buildAssetsDir,
          },
      ...assetDir,
    ],
    prerender: {
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
              buildDir,
            ]),
        ...nuxt.options.build.transpile.filter((i): i is string => typeof i === 'string'),
        'nuxt/dist',
        'nuxt3/dist',
        'nuxt-nightly/dist',
        distDir,
        // Ensure app config files have auto-imports injected even if they are pure .js files
        ...configExternals,
      ],
      traceInclude: [
        // force include files used in generated code from the runtime-compiler
        ...(nuxt.options.vue.runtimeCompiler && !nuxt.options.experimental.externalVue)
          ? [...moduleTraceInclude]
          : [],
      ],
    },
    alias: {
      // Vue 3 mocks
      ...nuxt.options.vue.runtimeCompiler || nuxt.options.experimental.externalVue
        ? {}
        : {
            'estree-walker': 'unenv/runtime/mock/proxy',
            '@babel/parser': 'unenv/runtime/mock/proxy',
            '@vue/compiler-core': 'unenv/runtime/mock/proxy',
            '@vue/compiler-dom': 'unenv/runtime/mock/proxy',
            '@vue/compiler-ssr': 'unenv/runtime/mock/proxy',
          },
      '@vue/devtools-api': 'vue-devtools-stub',

      // Paths
      '#internal/nuxt/paths': nitroPaths,

      // Nuxt aliases
      ...nuxt.options.alias,
    },
    replace: {
      'process.env.NUXT_NO_SSR': nuxt.options.ssr === false,
      'process.env.NUXT_EARLY_HINTS': nuxt.options.experimental.writeEarlyHints !== false,
      'process.env.NUXT_NO_SCRIPTS': !!nuxt.options.features.noScripts && !nuxt.options.dev,
      'process.env.NUXT_INLINE_STYLES': !!nuxt.options.features.inlineStyles,
      'process.env.NUXT_JSON_PAYLOADS': !!nuxt.options.experimental.renderJsonPayloads,
      'process.env.NUXT_ASYNC_CONTEXT': !!nuxt.options.experimental.asyncContext,
      'process.env.NUXT_SHARED_DATA': !!nuxt.options.experimental.sharedPrerenderData,
      'process.dev': nuxt.options.dev,
      '__VUE_PROD_DEVTOOLS__': false,
    },
    rollupConfig: {
      output: {},
      plugins: [],
    },
    logLevel: logLevelMapReverse[nuxt.options.logLevel],
  } satisfies NitroConfig)

  // Resolve user-provided paths
  nitroConfig.srcDir = resolve(nuxt.options.rootDir, nuxt.options.srcDir, nitroConfig.srcDir!)
  nitroConfig.ignore = [...(nitroConfig.ignore || []), ...resolveIgnorePatterns(nitroConfig.srcDir), `!${join(buildDir, 'dist/client', nuxt.options.app.buildAssetsDir, '**/*')}`]

  // Add app manifest handler and prerender configuration
  if (nuxt.options.experimental.appManifest) {
    const buildId = nuxt.options.runtimeConfig.app.buildId ||= nuxt.options.buildId
    const buildTimestamp = Date.now()

    const manifestPrefix = joinURL(nuxt.options.app.buildAssetsDir, 'builds')
    const tempDir = join(buildDir, 'manifest')
    const metaDir = join(tempDir, 'meta')
    const buildJson = join(tempDir, `meta/${buildId}.json`)
    nitroConfig.prerender ||= {}
    nitroConfig.prerender.ignore ||= []
    nitroConfig.prerender.ignore.push(manifestPrefix)

    nitroConfig.publicAssets!.unshift(
      // build manifest
      {
        dir: metaDir,
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

    nuxt.options.alias['#app-manifest'] = buildJson

    nuxt.hook('nitro:config', (config) => {
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
        for (const key in _routeRules) {
          if (key === '/__nuxt_error') { continue }
          let hasRules = false
          const filteredRules = {} as Record<string, any>
          for (const routeKey in _routeRules[key]) {
            const value = (_routeRules as any)[key][routeKey]
            if (!value) { continue }
            if (routeKey === 'prerender' || routeKey === 'redirect' || routeKey === 'appMiddleware') {
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

        await fsp.mkdir(metaDir, { recursive: true })
        await fsp.writeFile(join(tempDir, 'latest.json'), JSON.stringify({
          id: buildId,
          timestamp: buildTimestamp,
        }))
        await fsp.writeFile(buildJson, JSON.stringify(manifest))
      })
    })
  }

  // Add fallback server for `ssr: false`
  if (!nuxt.options.ssr) {
    nitroConfig.virtual!['#build/dist/server/server.mjs'] = 'export default () => {}'
    // In case a non-normalized absolute path is called for on Windows
    if (process.platform === 'win32') {
      nitroConfig.virtual!['#build/dist/server/server.mjs'.replace(/\//g, '\\')] = 'export default () => {}'
    }
  }

  if (nuxt.options.builder === '@nuxt/webpack-builder' || nuxt.options.dev) {
    nitroConfig.virtual!['#build/dist/server/styles.mjs'] = 'export default {}'
    // In case a non-normalized absolute path is called for on Windows
    if (process.platform === 'win32') {
      nitroConfig.virtual!['#build/dist/server/styles.mjs'.replace(/\//g, '\\')] = 'export default {}'
    }
  }

  // Add backward-compatible middleware to respect `x-nuxt-no-ssr` header
  if (nuxt.options.experimental.respectNoSSRHeader) {
    nitroConfig.handlers = nitroConfig.handlers || []
    nitroConfig.handlers.push({
      handler: resolve(distDir, 'core/runtime/nitro/no-ssr'),
      middleware: true,
    })
  }

  // Register nuxt protection patterns
  nitroConfig.rollupConfig!.plugins = await nitroConfig.rollupConfig!.plugins || []
  nitroConfig.rollupConfig!.plugins = toArray(nitroConfig.rollupConfig!.plugins)
  nitroConfig.rollupConfig!.plugins!.push(
    ImportProtectionPlugin.rollup({
      rootDir: nuxt.options.rootDir,
      modulesDir: nuxt.options.modulesDir,
      patterns: nuxtImportProtections(nuxt, { isNitro: true }),
      exclude: [/core[\\/]runtime[\\/]nitro[\\/]renderer/],
    }),
  )

  // Extend nitro config with hook
  await nuxt.callHook('nitro:config', nitroConfig)

  // TODO: extract to shared utility?
  const excludedAlias = [/^@vue\/.*$/, '#imports', '#vue-router', 'vue-demi', /^#app/]
  const basePath = nitroConfig.typescript!.tsConfig!.compilerOptions?.baseUrl ? resolve(buildDir, nitroConfig.typescript!.tsConfig!.compilerOptions?.baseUrl) : buildDir
  const aliases = nitroConfig.alias!
  const tsConfig = nitroConfig.typescript!.tsConfig!
  tsConfig.compilerOptions = tsConfig.compilerOptions || {}
  tsConfig.compilerOptions.paths = tsConfig.compilerOptions.paths || {}
  for (const _alias in aliases) {
    const alias = _alias as keyof typeof aliases
    if (excludedAlias.some(pattern => typeof pattern === 'string' ? alias === pattern : pattern.test(alias))) {
      continue
    }
    if (alias in tsConfig.compilerOptions.paths) { continue }

    const absolutePath = resolve(basePath, aliases[alias]!)
    const stats = await fsp.stat(absolutePath).catch(() => null /* file does not exist */)
    if (stats?.isDirectory()) {
      tsConfig.compilerOptions.paths[alias] = [absolutePath]
      tsConfig.compilerOptions.paths[`${alias}/*`] = [`${absolutePath}/*`]
    } else {
      tsConfig.compilerOptions.paths[alias] = [absolutePath.replace(/\b\.\w+$/g, '')] /* remove extension */
    }
  }

  // Init nitro
  const [nitro, spaLoadingTemplateFilePath] = await Promise.all([
    createNitro(nitroConfig, {
      // @ts-expect-error this will be valid in a future version of Nitro
      compatibilityDate: nuxt.options.compatibilityDate,
    }),
    spaLoadingTemplatePath(nuxt),
  ])

  // Trigger Nitro reload when SPA loading template changes
  nuxt.hook('builder:watch', async (_event, relativePath) => {
    const path = resolve(nuxt.options.srcDir, relativePath)
    if (path === spaLoadingTemplateFilePath) {
      await nitro.hooks.callHook('rollup:reload')
    }
  })

  const cacheDir = resolve(buildDir, 'cache/nitro/prerender')
  const cacheDriverPath = await resolvePath(join(distDir, 'core/runtime/nitro/cache-driver'))
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
    nuxt.hook('vite:extendConfig', (config, { isClient }) => {
      if (isClient) {
        if (Array.isArray(config.resolve!.alias)) {
          config.resolve!.alias.push({
            find: 'vue',
            replacement: 'vue/dist/vue.esm-bundler',
          })
        } else {
          config.resolve!.alias = {
            ...config.resolve!.alias,
            vue: 'vue/dist/vue.esm-bundler',
          }
        }
      }
    })
    nuxt.hook('webpack:config', (configuration) => {
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

  // Setup handlers
  const devMiddlewareHandler = dynamicEventHandler()
  nitro.options.devHandlers.unshift({ handler: devMiddlewareHandler })
  nitro.options.devHandlers.push(...nuxt.options.devServerHandlers)
  nitro.options.handlers.unshift({
    route: '/__nuxt_error',
    lazy: true,
    handler: renderer,
  })

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
    opts.tsConfig.exclude = opts.tsConfig.exclude || []
    opts.tsConfig.exclude.push(relative(buildDir, resolve(nuxt.options.rootDir, nitro.options.output.dir)))
    opts.references.push({ path: resolve(buildDir, 'types/nitro.d.ts') })
  })

  if (nitro.options.static) {
    nitro.hooks.hook('prerender:routes', (routes) => {
      3
      routes.add('/200.html')
      routes.add('/404.html')
      if (nuxt.options.ssr) {
        if (nitro.options.prerender.crawlLinks) {
          routes.add('/')
        }
      } else {
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

  // nuxt build/dev
  nuxt.hook('build:done', async () => {
    await nuxt.callHook('nitro:build:before', nitro)
    if (nuxt.options.dev) {
      await build(nitro)
    } else {
      await prepare(nitro)
      await prerender(nitro)

      logger.restoreAll()
      await build(nitro)
      logger.wrapAll()

      if (nitro.options.static && !existsSync(nuxtDistDir)) {
        await fsp.symlink(nitro.options.output.publicDir, nuxtDistDir, 'junction').catch(() => {})
      }
    }
  })

  // nuxt dev
  if (nuxt.options.dev) {
    nuxt.hook('webpack:compile', ({ compiler }) => { compiler.outputFileSystem = { ...fsExtra, join } as any })
    nuxt.hook('webpack:compiled', () => { nuxt.server.reload() })
    nuxt.hook('vite:compiled', () => { nuxt.server.reload() })

    nuxt.hook('server:devHandler', (h) => { devMiddlewareHandler.set(h) })
    nuxt.server = createDevServer(nitro)

    const waitUntilCompile = new Promise<void>(resolve => nitro.hooks.hook('compiled', () => resolve()))
    nuxt.hook('build:done', () => waitUntilCompile)
  }
}

function relativeWithDot (from: string, to: string) {
  return relative(from, to).replace(/^([^.])/, './$1') || '.'
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
      return readFileSync(spaLoadingTemplate, 'utf-8')
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
