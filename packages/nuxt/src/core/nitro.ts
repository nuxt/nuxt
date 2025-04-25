import { pathToFileURL } from 'node:url'
import { existsSync, promises as fsp, readFileSync } from 'node:fs'
import { cpus } from 'node:os'
import { join, relative, resolve } from 'pathe'
import { createRouter as createRadixRouter, exportMatcher, toRouteMatcher } from 'radix3'
import { joinURL, withTrailingSlash } from 'ufo'
import { build, copyPublicAssets, createDevServer, createNitro, prepare, prerender, writeTypes } from 'nitro'
import type { Nitro, NitroConfig, NitroOptions } from 'nitro/types'
import { createIsIgnored, findPath, logger, resolveAlias, resolveIgnorePatterns, resolveNuxtModule } from '@nuxt/kit'
import escapeRE from 'escape-string-regexp'
import { defu } from 'defu'
import { dynamicEventHandler } from 'h3'
import { isWindows } from 'std-env'
import { ImpoundPlugin } from 'impound'
import type { Nuxt, NuxtOptions } from 'nuxt/schema'
import { resolveModulePath } from 'exsolve'

import { version as nuxtVersion } from '../../package.json'
import { distDir } from '../dirs'
import { toArray } from '../utils'
import { template as defaultSpaLoadingTemplate } from '../../../ui-templates/dist/templates/spa-loading-icon'
import { createImportProtectionPatterns } from './plugins/import-protection'

const logLevelMapReverse = {
  silent: 0,
  info: 3,
  verbose: 3,
} satisfies Record<NuxtOptions['logLevel'], NitroConfig['logLevel']>

const NODE_MODULES_RE = /(?<=\/)node_modules\/(.+)$/
const PNPM_NODE_MODULES_RE = /\.pnpm\/.+\/node_modules\/(.+)$/
export async function initNitro (nuxt: Nuxt & { _nitro?: Nitro }) {
  // Resolve config
  const excludePaths = nuxt.options._layers
    .flatMap(l => [
      l.cwd.match(NODE_MODULES_RE)?.[1],
      l.cwd.match(PNPM_NODE_MODULES_RE)?.[1],
    ])
    .filter((dir): dir is string => Boolean(dir))
    .map(dir => escapeRE(dir))
  const excludePattern = excludePaths.length
    ? [new RegExp(`node_modules\\/(?!${excludePaths.join('|')})`)]
    : [/node_modules/]

  const rootDirWithSlash = withTrailingSlash(nuxt.options.rootDir)

  const modules = await resolveNuxtModule(rootDirWithSlash,
    nuxt.options._installedModules
      .filter(m => m.entryPath)
      .map(m => m.entryPath!),
  )

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

  const mockProxy = resolveModulePath('mocked-exports/proxy', { from: import.meta.url })

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
      version: nuxtVersion,
    },
    imports: {
      autoImport: nuxt.options.imports.autoImport as boolean,
      dirs: [...sharedDirs],
      imports: [
        {
          as: '__buildAssetsURL',
          name: 'buildAssetsURL',
          from: resolve(distDir, 'core/runtime/nitro/utils/paths'),
        },
        {
          as: '__publicAssetsURL',
          name: 'publicAssetsURL',
          from: resolve(distDir, 'core/runtime/nitro/utils/paths'),
        },
        {
          // TODO: Remove after https://github.com/nitrojs/nitro/issues/1049
          as: 'defineAppConfig',
          name: 'defineAppConfig',
          from: resolve(distDir, 'core/runtime/nitro/utils/config'),
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
    scanDirs: nuxt.options._layers.map(layer => (layer.config.serverDir || layer.config.srcDir) && resolve(layer.cwd, layer.config.serverDir || resolve(layer.config.srcDir, 'server'))).filter(Boolean),
    renderer: resolve(distDir, 'core/runtime/nitro/handlers/renderer'),
    nodeModulesDirs: nuxt.options.modulesDir,
    handlers: nuxt.options.serverHandlers,
    devHandlers: [],
    baseURL: nuxt.options.app.baseURL,
    virtual: {
      '#internal/nuxt.config.mjs': () => nuxt.vfs['#build/nuxt.config.mjs'] || '',
      '#internal/nuxt/app-config': () => nuxt.vfs['#build/app.config.mjs']?.replace(/\/\*\* client \*\*\/[\s\S]*\/\*\* client-end \*\*\//, '') || '',
      '#spa-template': async () => `export const template = ${JSON.stringify(await spaLoadingTemplate(nuxt))}`,
    },
    routeRules: {
      '/__nuxt_error': { cache: false },
    },
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
          ...modules.map(m => join(relativeWithDot(nuxt.options.buildDir, m), 'runtime/server')),
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
      ...nuxt.options._layers
        .map(layer => resolve(layer.config.srcDir, (layer.config.rootDir === nuxt.options.rootDir ? nuxt.options.dir : layer.config.dir)?.public || 'public'))
        .filter(dir => existsSync(dir))
        .map(dir => ({ dir })),
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
        ...nuxt.options._layers.map(layer => resolve(layer.config.srcDir, 'app.config')),
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
      '#internal/nuxt/paths': resolve(distDir, 'core/runtime/nitro/utils/paths'),
    },
    replace: {
      'process.env.NUXT_NO_SSR': String(nuxt.options.ssr === false),
      'process.env.NUXT_EARLY_HINTS': String(nuxt.options.experimental.writeEarlyHints !== false),
      'process.env.NUXT_NO_SCRIPTS': String(nuxt.options.features.noScripts === 'all' || (!!nuxt.options.features.noScripts && !nuxt.options.dev)),
      'process.env.NUXT_INLINE_STYLES': String(!!nuxt.options.features.inlineStyles),
      'process.env.PARSE_ERROR_DATA': String(!!nuxt.options.experimental.parseErrorData),
      'process.env.NUXT_JSON_PAYLOADS': String(!!nuxt.options.experimental.renderJsonPayloads),
      'process.env.NUXT_ASYNC_CONTEXT': String(!!nuxt.options.experimental.asyncContext),
      'process.env.NUXT_SHARED_DATA': String(!!nuxt.options.experimental.sharedPrerenderData),
      'process.dev': String(nuxt.options.dev),
      '__VUE_PROD_DEVTOOLS__': String(false),
    },
    rollupConfig: {
      output: {},
      plugins: [],
    },
    logLevel: logLevelMapReverse[nuxt.options.logLevel],
  } satisfies NitroConfig)

  if (nuxt.options.experimental.serverAppConfig && nitroConfig.imports) {
    nitroConfig.imports.imports ||= []
    nitroConfig.imports.imports.push({
      name: 'useAppConfig',
      from: resolve(distDir, 'core/runtime/nitro/utils/app-config'),
    })
  }

  // add error handler
  if (!nitroConfig.errorHandler && (nuxt.options.dev || !nuxt.options.experimental.noVueServer)) {
    nitroConfig.errorHandler = resolve(distDir, 'core/runtime/nitro/handlers/error')
  }

  // Resolve user-provided paths
  nitroConfig.srcDir = resolve(nuxt.options.rootDir, nuxt.options.srcDir, nitroConfig.srcDir!)
  nitroConfig.ignore ||= []
  nitroConfig.ignore.push(
    ...resolveIgnorePatterns(nitroConfig.srcDir),
    `!${join(nuxt.options.buildDir, 'dist/client', nuxt.options.app.buildAssetsDir, '**/*')}`,
  )

  // Resolve aliases in user-provided input - so `~/server/test` will work
  nitroConfig.plugins = nitroConfig.plugins?.map(plugin => plugin ? resolveAlias(plugin, nuxt.options.alias) : plugin)

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
            value.noScripts = value.experimentalNoScripts
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
        for (const key in _routeRules) {
          if (key === '/__nuxt_error') { continue }
          let hasRules = false
          const filteredRules = {} as Record<string, any>
          for (const routeKey in _routeRules[key]) {
            const value = (_routeRules as any)[key][routeKey]
            if (['prerender', 'redirect', 'appMiddleware'].includes(routeKey) && value) {
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
      exclude: [/node_modules[\\/]nitro(?:pack)?(?:-nightly)?[\\/]|core[\\/]runtime[\\/]nitro[\\/](?:handlers|utils)/, ...sharedPatterns],
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
    const stats = await fsp.stat(absolutePath).catch(() => null /* file does not exist */)
    // note - nitro will check + remove the file extension as required
    tsConfig.compilerOptions.paths[alias] = [absolutePath]
    if (stats?.isDirectory()) {
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
  const cacheDriverPath = join(distDir, 'core/runtime/nitro/utils/cache-driver.js')
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
    handler: resolve(distDir, 'core/runtime/nitro/handlers/renderer'),
  })

  if (!nuxt.options.dev && nuxt.options.experimental.noVueServer) {
    nitro.hooks.hook('rollup:before', (nitro) => {
      if (nitro.options.preset === 'nitro-prerender') {
        nitro.options.errorHandler = resolve(distDir, 'core/runtime/nitro/handlers/error')
        return
      }
      const nuxtErrorHandler = nitro.options.handlers.findIndex(h => h.route === '/__nuxt_error')
      if (nuxtErrorHandler >= 0) {
        nitro.options.handlers.splice(nuxtErrorHandler, 1)
      }

      nitro.options.renderer = undefined
    })
  }

  // Add typed route responses
  nuxt.hook('prepare:types', async (opts) => {
    if (!nuxt.options.dev) {
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
