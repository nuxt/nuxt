import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'
import { existsSync, promises as fsp, readFileSync } from 'node:fs'
import { cpus } from 'node:os'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import type { Nuxt, NuxtOptions, ServerRouteSegment } from '@nuxt/schema'
import { join, relative, resolve } from 'pathe'
import { joinURL, withTrailingSlash, withoutTrailingSlash } from 'ufo'
import nuxtPkg from 'nuxt/package.json' with { type: 'json' }
import { createNitro } from 'nitro/builder'
import type { Nitro, NitroConfig } from 'nitro/types'
import { addPlugin, addTemplate, addVitePlugin, createIsIgnored, ensureDependencyInstalled, findPath, getAddDependencyCommand, getLayerDirectories, resolveAlias, resolveIgnorePatterns } from '@nuxt/kit'
import { bundlerDiagnostics, setServerBuild } from '@nuxt/kit/internal'
import escapeRE from 'escape-string-regexp'
import { defu } from 'defu'
import { defineEventHandler } from 'nitro/h3'
import { isWindows } from 'std-env'
import { rou3PatternToURLPattern } from 'unrouting'
import { ImpoundPlugin } from 'impound'
import { resolveModulePath } from 'exsolve'
import { runtimeDependencies } from 'nitro/meta'

import nitroBuilder from '../package.json' with { type: 'json' }
import { NUXT_BUILD_OUTPUT_MAP, distDir, getLayerNodeModulesExcludePattern, getSsrResolveConditions, toArray } from './utils.ts'
import { setupNitroViteEnvironment } from './vite.ts'
import { setupLegacyDevAndBuild } from './legacy.ts'
import { LOOPBACK_HOSTS, isLocalDevRequest, isLoopbackPeer } from './dev-request.ts'
import { template as defaultSpaLoadingTemplate } from './templates/spa-loading-icon.ts'
import { addRoute as addRou3Route, createRouter as createRou3Router, routeNodeKeys } from 'rou3'
import { compileRouterToString } from 'rou3/compiler'
// TODO: figure out a good way to share this
import { createImportProtectionPatterns } from '../../nuxt/src/core/plugins/import-protection.ts'
import { createNormalizedRouteRulesRouter, normalizeRouteRulePath } from '../../nuxt/src/core/utils/route-rules.ts'
import { nitroSchemaTemplate } from './templates.ts'
import { getH3ImportsPreset, v2ImportsPreset } from './imports.ts'
import { createServerAutoImports, resolveServerImportDirs } from './auto-imports.ts'
import { normalizeLegacyRouteRules } from './route-rules.ts'
import type { ServerImportsOptions } from './auto-imports.ts'
import { ServerAutoImportsPlugin } from './auto-imports-plugin.ts'
// Re-export a type from the augment module rather than a bare `import './augments.ts'`
// side-effect import to work around bug in oxc's dts emitter which drops side-effect-only imports
export type { NuxtTracingChannelOptions } from './augments.ts'

/** Subpath the request-shape extractors are imported from in generated declarations. */
const REQUEST_TYPES_MODULE = '@nuxt/nitro-server/request-types'

// App-only aliases Nitro carries in its own alias map, which must not resolve in the server program
const excludedServerAlias = [/^@vue\/.*$/, 'vue', /vue-router/, 'vite/client', /^#imports/, 'vue-demi', /^#app/, '~', '@', '~~', '@@']

const logLevelMapReverse = {
  silent: 0,
  info: 3,
  verbose: 3,
} satisfies Record<NuxtOptions['logLevel'], NitroConfig['logLevel']>

export async function bundle (nuxt: Nuxt & { _nitro?: Nitro }): Promise<void> {
  // Resolve config
  // status codes whose error page is server-rendered at build time
  const errorPageOption = nuxt.options.experimental.prerenderErrorPages
  const errorPages = errorPageOption === true ? [404] : errorPageOption || []
  const layerDirs = getLayerDirectories(nuxt)
  const excludePattern = [getLayerNodeModulesExcludePattern(layerDirs.map(dirs => dirs.root))]

  const layerPublicAssetsDirs: Array<{ dir: string, maxAge: number }> = []
  for (const dirs of layerDirs) {
    if (existsSync(dirs.public)) {
      layerPublicAssetsDirs.push({ dir: dirs.public, maxAge: 0 })
    }
  }

  addTemplate(nitroSchemaTemplate)

  const importDirs = new Set<string>()
  if (nuxt.options.nitro.imports !== false) {
    for (const dir of resolveServerImportDirs(nuxt)) {
      importDirs.add(dir)
    }
  }

  // Resolve aliases in user-provided input - so `~~/server/test` will work
  nuxt.options.nitro.plugins ||= []
  nuxt.options.nitro.plugins = nuxt.options.nitro.plugins.map(plugin => plugin ? resolveAlias(plugin, nuxt.options.alias) : plugin)

  for (const asset of [...nuxt.options.nitro.publicAssets || [], ...nuxt.options.nitro.serverAssets || []]) {
    if (asset?.dir) {
      asset.dir = resolveAlias(asset.dir, nuxt.options.alias)
    }
  }

  // a missing `dir` is otherwise silent: nitro registers the base URL and serves a hard 404 from it
  for (const asset of nuxt.options.nitro.publicAssets || []) {
    if (asset?.dir && !existsSync(resolve(nuxt.options.rootDir, asset.dir))) {
      bundlerDiagnostics.NUXT_B7023({ dir: asset.dir, baseURL: joinURL('/', asset.baseURL || '/', '**') })
    }
  }

  if (nuxt.options.dev && nuxt.options.features.devLogs) {
    addPlugin(resolve(nuxt.options.appDir, 'plugins/dev-server-logs'))
    nuxt.options.nitro.plugins.push(resolve(distDir, 'runtime/plugins/dev-server-logs'))
    nuxt.options.nitro.virtual = defu(nuxt.options.nitro.virtual, {
      '#internal/dev-server-logs-options': () => `export const rootDir = ${JSON.stringify(nuxt.options.rootDir)};`,
    })
  }

  // When the base URL is only known at runtime, the `base-url` middleware strips it from incoming
  // requests, so nitro's routes must stay unprefixed for the internally re-dispatched request to
  // match them.
  const nitroBaseURL = nuxt.options.experimental.runtimeBaseURL ? '/' : nuxt.options.app.baseURL
  if (nuxt.options.experimental.runtimeBaseURL) {
    nuxt.options.serverHandlers.unshift({
      route: '',
      middleware: true,
      handler: resolve(distDir, 'runtime/middleware/base-url'),
    })
  }

  // In dev, record per-request CSS (from the builder's module graph) into the
  // request context so the SSR renderer can emit the right stylesheet links.
  if (nuxt.options.dev) {
    nuxt.options.serverHandlers.unshift({
      route: '',
      middleware: true,
      handler: resolve(distDir, 'runtime/middleware/dev-client-css'),
    })
  }

  if (nuxt.options.experimental.componentIslands) {
    const islandHandlerPath = JSON.stringify(resolve(distDir, 'runtime/handlers/island'))
    const ISLAND_RENDERER_KEY = '#internal/nuxt/island-renderer.mjs'

    nuxt.options.nitro.virtual ||= {}
    nuxt.options.nitro.virtual[ISLAND_RENDERER_KEY] = () => {
      // sync conditions with /packages/nuxt/src/core/templates.ts#L539
      if (nuxt.options.dev || nuxt.options.experimental.componentIslands !== 'auto' || nuxt.apps.default?.pages?.some(p => p.mode === 'server') || nuxt.apps.default?.components?.some(c => c.mode === 'server' && !nuxt.apps.default?.components.some(other => other.pascalName === c.pascalName && other.mode === 'client'))) {
        return `export { default } from ${islandHandlerPath}`
      }
      return `export default { fetch: () => undefined }`
    }

    if (!nuxt.options.ssr && nuxt.options.experimental.componentIslands !== 'auto') {
      nuxt.options.ssr = true
      nuxt.options.nitro.routeRules ||= {}
      nuxt.options.nitro.routeRules['/**'] = defu(nuxt.options.nitro.routeRules['/**'], { ssr: false })
    }
  }

  const mockProxy = resolveModulePath('mocked-exports/proxy', { from: import.meta.url })
  const typesDir = nuxt.options.typesDir || nuxt.options.buildDir

  const autoImportPresets = nuxt.options.experimental.nitroAutoImports
    ? [...v2ImportsPreset, await getH3ImportsPreset()]
    : []

  const nitroConfig: NitroConfig = defu(nuxt.options.nitro, {
    debug: nuxt.options.debug ? nuxt.options.debug.nitro : false,
    rootDir: nuxt.options.rootDir,
    workspaceDir: nuxt.options.workspaceDir,
    serverDir: nuxt.options.serverDir,
    dev: nuxt.options.dev,
    buildDir: nuxt.options.buildDir,
    experimental: {
      asyncContext: nuxt.options.experimental.asyncContext,
      typescriptBundlerResolution: nuxt.options.future.typescriptBundlerResolution || nuxt.options.typescript?.tsConfig?.compilerOptions?.moduleResolution?.toLowerCase() === 'bundler' || nuxt.options.nitro.typescript?.tsConfig?.compilerOptions?.moduleResolution?.toLowerCase() === 'bundler',
    },
    framework: {
      name: 'nuxt',
      version: nuxtPkg.version || nitroBuilder.version,
    },
    imports: {
      autoImport: nuxt.options.imports.autoImport as boolean,
      dirs: [...importDirs],
      presets: autoImportPresets,
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
    baseURL: nitroBaseURL,
    virtual: {
      '#internal/nuxt.config.mjs': () => nuxt.vfs['#build/nuxt.config.mjs'] || '',
      '#internal/nuxt/app-config': () => nuxt.vfs['#build/app.config.mjs']?.replace(/\/\*\* client \*\*\/[\s\S]*\/\*\* client-end \*\*\//, '') || '',
      '#spa-template': async () => `export const template = ${JSON.stringify(await spaLoadingTemplate(nuxt))}`,
      // Build output defaults; overridden by builders via setBuildOutput(). Kept
      // here (rather than in the loop below) so they resolve in the nitro
      // environment even when the loop is scoped away from it.
      'nuxt/entry-chunk': () => nuxt.buildOutputs.entryChunkName(),
      'nuxt/entry-ids': () => nuxt.buildOutputs.entryIds(),
      // Dev-only per-request CSS source; overridden by the builder in dev to
      // read its module graph (see `dev-client-css` middleware).
      '#internal/nuxt/dev-client-css': () => `export const getDevClientCss = () => []`,
      // overridden by head module when SSR streaming is enabled
      '#internal/streaming-iife-chunk.mjs': () => `export const iifeChunkFileName = undefined`,
      '#internal/nuxt/nitro-config.mjs': () => {
        const hasCachedRoutes = nitro.routing.routeRules.routes.some(r => r.data.isr || r.data.cache)
        // `href_matches` patterns (URLPattern syntax) for routes served under a
        // `noScripts` route rule, so scripted documents can speculatively
        // prefetch/prerender the full-page navigation the client router forces
        // to them.
        const noScriptsPatterns = [...new Set(nitro.routing.routeRules.routes
          .filter(r => r.data.noScripts)
          .map(r => rou3PatternToURLPattern(r.route).pattern))]
        // `href_matches` patterns for every page route, provided by the pages
        // module; pages served without scripts scope their blanket speculation
        // rules to these (safe-to-GET) same-origin navigations
        const pagePatterns = (nitro.options as { _noScriptsPagePatterns?: string[] })._noScriptsPagePatterns ?? []
        // rou3 patterns for every page route, provided by the pages module when
        // `experimental.early404` is active; the renderer 404s early on paths that
        // cannot match any of them
        const early404Patterns = (nitro.options as { _early404PagePatterns?: string[] })._early404PagePatterns ?? []
        // SPA fallbacks written out as an empty shell, minus any error page that
        // is server-rendered at build time
        const noSSRRoutes = ['/index.html', '/200.html', '/404.html'].filter(route => !errorPages.includes(Number(route.slice(1, -'.html'.length))))
        return [
          `export const NUXT_NO_SSR = ${nuxt.options.ssr === false}`,
          `export const NUXT_PRERENDER_ERROR_PAGES = ${JSON.stringify(errorPages)}`,
          `export const NUXT_PRERENDER_NO_SSR_ROUTES = ${JSON.stringify(noSSRRoutes)}`,
          `export const NUXT_EARLY_HINTS = ${nuxt.options.experimental.writeEarlyHints !== false}`,
          `export const NUXT_NO_SCRIPTS = ${nuxt.options.features.noScripts === 'all' || (!!nuxt.options.features.noScripts && !nuxt.options.dev)}`,
          `export const NUXT_NO_SCRIPTS_PROD = ${nuxt.options.features.noScripts === 'production'}`,
          `export const NUXT_INLINE_STYLES = ${!!nuxt.options.features.inlineStyles}`,
          `export const NUXT_VIEW_TRANSITIONS = ${!!(nuxt.options.app.viewTransition && typeof nuxt.options.app.viewTransition === 'object' && nuxt.options.app.viewTransition.enabled)}`,
          `export const NUXT_NO_SCRIPTS_PATTERNS = ${JSON.stringify(noScriptsPatterns)}`,
          `export const NUXT_PAGE_PATTERNS = ${JSON.stringify(pagePatterns)}`,
          `export const NUXT_EARLY_404 = ${early404Patterns.length > 0}`,
          `export ${compilePageMatcher(early404Patterns)}`,
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          `export const PARSE_ERROR_DATA = ${!!nuxt.options.experimental.parseErrorData}`,
          `export const NUXT_ASYNC_CONTEXT = ${!!nuxt.options.experimental.asyncContext}`,
          `export const NUXT_SHARED_DATA = ${!!nuxt.options.experimental.sharedPrerenderData}`,
          `export const NUXT_PAYLOAD_EXTRACTION = ${nuxt.options.experimental.payloadExtraction !== false}`,
          `export const NUXT_PAYLOAD_INLINE = ${nuxt.options.experimental.payloadExtraction !== true}`,
          `export const NUXT_RUNTIME_PAYLOAD_EXTRACTION = ${hasCachedRoutes}`,
          `export const NUXT_SSR_STREAMING = ${!!(typeof nuxt.options.experimental.ssrStreaming === 'object' && nuxt.options.experimental.ssrStreaming.enabled)}`,
          `export const NUXT_SSR_STREAMING_BOT_RE = ${typeof nuxt.options.experimental.ssrStreaming === 'object' && nuxt.options.experimental.ssrStreaming.botRegex instanceof RegExp ? String(nuxt.options.experimental.ssrStreaming.botRegex) : '/^$/'}`,
        ].join('\n')
      },
    },
    routeRules: {
      '/**': typeof nuxt.options.experimental.ssrStreaming === 'object' && nuxt.options.experimental.ssrStreaming.enabled
        ? { ssr: true, streaming: true }
        : { ssr: true },
      '/__nuxt_error': { cache: false },
    },
    rolldownConfig: {
      // don't try to resolve rolldown options from the tsconfig we generate
      tsconfig: false,
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
            ignore: false,
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
      ...(nuxt.options.vue.runtimeCompiler)
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
      ...nuxt.options.vue.runtimeCompiler
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
  nitroConfig.ignore.push(...resolveIgnorePatterns(nitroConfig.serverDir))

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
            if (value.ssr === false) { continue }
            if ((value.isr || value.cache) || (value.prerender && nuxt.options.dev)) {
              const payloadKey = (route === '/' ? '' : route) + '/_payload.json'
              const defaults = { ssr: true } as Record<string, any>
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
    nitroConfig.prerender.ignore.push(joinURL(nitroBaseURL, manifestPrefix))

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
    if (!nuxt.options.dev || nuxt.options.experimental.nitroViteEnvironment) {
      nuxt.hook('build:before', async () => {
        await fsp.mkdir(join(tempDir, 'meta'), { recursive: true })
        await fsp.writeFile(join(tempDir, `meta/${buildId}.json`), JSON.stringify({
          id: buildId,
          timestamp: buildTimestamp,
          prerendered: [],
        }))
      })
    }

    nuxt.hook('nitro:config', (config) => {
      config.alias ||= {}
      config.alias['#app-manifest'] = join(tempDir, `meta/${buildId}.json`)
    })

    nuxt.hook('nitro:init', (nitro) => {
      const isEnvApi = nuxt.options.experimental.nitroViteEnvironment
      async function writeAppManifest (target?: 'public') {
        // Add pages prerendered but not covered by route rules
        const prerenderedRoutes = new Set<string>()
        if (nitro._prerenderedRoutes?.length) {
          const payloadSuffix = '/_payload.json'
          const caseSensitiveRouteRules = !!nuxt.options.router.options.sensitive
          const routeRulesMatcher = createNormalizedRouteRulesRouter(nitro.routing.routeRules, nitro.options.baseURL, !caseSensitiveRouteRules)
          for (const route of nitro._prerenderedRoutes) {
            if (!route.error && route.route.endsWith(payloadSuffix)) {
              const url = route.route.slice(0, -payloadSuffix.length) || '/'
              const rules = defu({}, ...routeRulesMatcher.matchAll('', normalizeRouteRulePath(url, !caseSensitiveRouteRules)).reverse()) as Record<string, any>
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

        const dir = target === 'public'
          ? join(nitro.options.output.publicDir, manifestPrefix)
          : tempDir
        await fsp.mkdir(join(dir, 'meta'), { recursive: true })
        await fsp.writeFile(join(dir, 'latest.json'), JSON.stringify({
          id: buildId,
          timestamp: buildTimestamp,
        }))
        await fsp.writeFile(join(dir, `meta/${buildId}.json`), JSON.stringify(manifest))
      }
      // seed the manifest so `#app-manifest` resolves during bundling,
      // and refresh it after prerendering with the actual prerendered routes.
      // `rollup:before` is not called when nitro runs as a vite environment,
      // and its output directory is emptied after `build:before`, so the final
      // copy is emitted once public assets have been copied.
      nitro.hooks.hook(isEnvApi ? 'build:before' : 'rollup:before', () => writeAppManifest())
      if (isEnvApi) {
        nitro.hooks.hook('compiled', () => writeAppManifest('public'))
      }
      nitro.hooks.hook('prerender:done', () => writeAppManifest(isEnvApi ? 'public' : undefined))
    })
  }

  // add stub alias to allow vite to resolve import
  if (!nuxt.options.experimental.appManifest) {
    nuxt.options.alias['#app-manifest'] = mockProxy
  }

  // with `nitroViteEnvironment` these specifiers provided by `NuxtBuildOutputsPlugin`
  if (!nuxt.options.experimental.nitroViteEnvironment) {
    for (const [specifier, key] of Object.entries(NUXT_BUILD_OUTPUT_MAP)) {
      if (specifier === 'nuxt/entry-chunk' || specifier === 'nuxt/entry-ids') {
        continue // already registered above in the virtual block
      }
      nitroConfig.virtual![specifier] = () => nuxt.buildOutputs[key]()
    }
  }

  const nitroDecoratorSetup = new WeakMap<NitroConfig, Promise<void>>()
  const setupNitroDecorators = (nitroConfig: NitroConfig) => {
    const existingSetup = nitroDecoratorSetup.get(nitroConfig)
    if (existingSetup) {
      return existingSetup
    }

    const setup = (async () => {
      const nitroDecoratorDeps = ['@rollup/plugin-babel', '@babel/plugin-proposal-decorators', '@babel/plugin-syntax-typescript']
      const result = await ensureDependencyInstalled(nitroDecoratorDeps, {
        rootDir: nuxt.options.rootDir,
        searchPaths: nuxt.options.modulesDir,
        from: import.meta.url,
      })

      if (result !== true) {
        bundlerDiagnostics.NUXT_B7009({ deps: result.map(d => `\`${d}\``).join(' and '), installCommand: await getAddDependencyCommand(result, nuxt.options.rootDir, { dev: true }) })
      }

      if (result === true) {
        const { babel } = await import('@rollup/plugin-babel')
        nitroConfig.rollupConfig!.plugins = toArray(await nitroConfig.rollupConfig!.plugins || [])
        nitroConfig.rollupConfig!.plugins!.unshift(
          babel({
            babelHelpers: 'bundled',
            configFile: false,
            extensions: ['.ts', '.js', '.mjs', '.mts'],
            plugins: [
              // Syntax plugin allows Babel to parse TypeScript without transforming it,
              // since the actual TS stripping is handled later by the bundler's esbuild plugin.
              ['@babel/plugin-syntax-typescript', { isTSX: false }],
              ['@babel/plugin-proposal-decorators', { version: '2023-11' }],
            ],
          }),
          babel({
            babelHelpers: 'bundled',
            configFile: false,
            extensions: ['.tsx', '.jsx'],
            plugins: [
              ['@babel/plugin-syntax-typescript', { isTSX: true }],
              ['@babel/plugin-proposal-decorators', { version: '2023-11' }],
            ],
          }),
        )
      }
    })()

    nitroDecoratorSetup.set(nitroConfig, setup)
    setup.catch(() => nitroDecoratorSetup.delete(nitroConfig))
    return setup
  }

  // Add decorator support via Babel when experimental.decorators is enabled.
  if (nuxt.options.experimental.decorators) {
    if (nuxt.options.dev) {
      nuxt.hook('nitro:build:before', nitro => setupNitroDecorators(nitro.options))
    } else {
      await setupNitroDecorators(nitroConfig)
    }
  }

  // Register nuxt protection patterns
  nitroConfig.rollupConfig!.plugins = await nitroConfig.rollupConfig!.plugins || []
  nitroConfig.rollupConfig!.plugins = toArray(nitroConfig.rollupConfig!.plugins)

  const sharedDir = withTrailingSlash(resolve(nuxt.options.rootDir, nuxt.options.dir.shared))
  const relativeSharedDir = withTrailingSlash(relative(nuxt.options.rootDir, resolve(nuxt.options.rootDir, nuxt.options.dir.shared)))
  const sharedPatterns = [/^#shared\//, new RegExp('^' + escapeRE(sharedDir)), new RegExp('^' + escapeRE(relativeSharedDir))]
  const trace = nuxt.options.dev ? true : 'lazy' as const
  // Both matchers share a single plugin instance so eager tracing parses each module once.
  const serverProtectionConfig = {
    cwd: nuxt.options.rootDir,
    trace,
    matchers: [
      {
        include: sharedPatterns,
        patterns: createImportProtectionPatterns(nuxt, { context: 'shared' as const }),
      },
      {
        patterns: createImportProtectionPatterns(nuxt, { context: 'nitro-app' as const }),
        exclude: [/node_modules[\\/]nitro(?:pack)?(?:-nightly)?[\\/]|(packages|@nuxt)[\\/]nitro-server(?:-nightly)?[\\/](src|dist)[\\/]runtime[\\/]/, ...sharedPatterns],
      },
    ],
  }
  nitroConfig.rollupConfig!.plugins!.push(ImpoundPlugin.rollup(serverProtectionConfig))

  // register same protection when building
  if (nuxt.options.experimental.nitroViteEnvironment) {
    nuxt.options.vite.plugins ||= []
    for (const plugin of [ImpoundPlugin.vite(serverProtectionConfig)].flat()) {
      nuxt.options.vite.plugins.push(Object.assign(plugin, {
        name: `nuxt:server-import-protection:${plugin.name}`,
        applyToEnvironment: (env: { name: string }) => env.name === 'nitro',
      }))
    }
  }

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

  const cacheDriverPath = join(distDir, 'runtime/utils/cache-driver.mjs')
  const cacheDriverOption = isWindows ? pathToFileURL(cacheDriverPath).href : cacheDriverPath

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
    // route rule augmentations are declared on `h3/rules`, so a project has to resolve it to the
    // same copy of h3 for them to apply
    'h3/rules',
    'consola',
    'ofetch',
    'crossws',
  )

  // Extend nitro config with hook
  await nuxt.callHook('nitro:config', nitroConfig)

  // after the hook, so rules contributed by modules are covered too
  normalizeLegacyRouteRules(nitroConfig.routeRules)

  const autoImports = createServerAutoImports(nuxt, nitroConfig.imports || { autoImport: false }, typesDir)
  // only for the server bundle: `nuxt.options.alias['#imports']` belongs to the app context
  nitroConfig.alias ||= {}
  nitroConfig.alias['#imports/server'] = autoImports.importsModulePath
  // deprecated, and deliberately left out of the server tsconfig: typing it would give a handler
  // an `any` return type, silently costing the route its response type
  nitroConfig.alias['#imports'] = autoImports.importsModulePath

  if (autoImports.enabled) {
    const autoImportsPluginOptions = { autoImports, sourcemap: !!nuxt.options.sourcemap.server }
    nitroConfig.rollupConfig!.plugins!.push(ServerAutoImportsPlugin.rollup(autoImportsPluginOptions))

    if (nuxt.options.experimental.nitroViteEnvironment) {
      nuxt.options.vite.plugins ||= []
      for (const plugin of [ServerAutoImportsPlugin.vite(autoImportsPluginOptions)].flat()) {
        nuxt.options.vite.plugins.push(Object.assign(plugin, {
          applyToEnvironment: (env: { name: string }) => env.name === 'nitro',
        }))
      }
    }

    // a file added to or removed from a scanned directory changes the auto-import set
    const scannedDirs = (nitroConfig.imports as ServerImportsOptions).dirs ?? []
    nuxt.hook('builder:watch', async (event, relativePath) => {
      if (event !== 'add' && event !== 'unlink') { return }
      const path = resolve(nuxt.options.srcDir, relativePath)
      if (!scannedDirs.some(dir => path === dir || path.startsWith(dir + '/'))) { return }
      await autoImports.refresh()
      await autoImports.writeTypes()
    })
  }

  if (nitroConfig.static && nuxt.options.dev) {
    nitroConfig.routeRules ||= {}
    nitroConfig.routeRules['/**'] = defu(nitroConfig.routeRules['/**'], { prerender: true })
  }

  if (nuxt.options.experimental.nitroViteEnvironment) {
    nitroConfig.renderer = undefined
  }

  // Init nitro
  nuxt._perf?.startPhase('nitro:createNitro')
  const nitro = await createNitro(nitroConfig, {
    compatibilityDate: nuxt.options.compatibilityDate,
    dotenv: nuxt.options._loadOptions?.dotenv,
  })
  nuxt._perf?.endPhase('nitro:createNitro')

  // TODO: remove when devtools gains support for nitro v3
  // @ts-expect-error devtools calls storage.watch() and storage.getMount()
  nitro.storage ||= { watch: () => {}, getMount: () => ({}) }

  // For full-static output, ensure payload extraction is not disabled
  if (nuxt.options.ssr && nitro.options.static && nuxt.options.experimental.payloadExtraction === false) {
    bundlerDiagnostics.NUXT_B7015()
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
  await fsp.rm(cacheDir, { recursive: true, force: true }).catch(() => {})
  nitro.options._config.storage = defu(nitro.options._config.storage, {
    'internal:nuxt:prerender': {
      // TODO: resolve upstream where file URLs are not being resolved/inlined correctly
      driver: cacheDriverOption,
      base: cacheDir,
    },
  })

  // Expose nitro to modules and kit
  nuxt._nitro = nitro
  setServerBuild({
    name: 'nitro',
    label: 'Nitro',
    target: () => nitro.options.preset,
    targetLabel: 'preset',
    output: {
      dir: () => withoutTrailingSlash(nitro.options.output.dir),
      publicDir: () => withoutTrailingSlash(nitro.options.output.publicDir),
    },
    capabilities: { server: true, dev: true },
    buildsSeparately: !nuxt.options.experimental.nitroViteEnvironment,
    imports: () => autoImports.getImports(),
    runtime: { fetch: 'nitro', runtimeConfig: 'nitro/runtime-config' },
    preview: { command: () => nitro.options.commands.preview },
  }, nuxt)
  await nuxt.callHook('nitro:init', nitro)

  // Instrument Nitro rollup plugins for perf tracking
  if (nuxt._perf) {
    nitro.hooks.hook('rollup:before', (_nitro, rollupConfig) => {
      const plugins = (rollupConfig.plugins || []) as Array<{ name?: string, transform?: (...a: any[]) => any, resolveId?: (...a: any[]) => any, load?: (...a: any[]) => any } | null>
      for (const plugin of plugins) {
        if (!plugin || !plugin.name) { continue }
        const pluginName = `nitro:${plugin.name}`
        for (const hookName of ['transform', 'resolveId', 'load'] as const) {
          const original = plugin[hookName]
          if (typeof original !== 'function') { continue }
          plugin[hookName] = function (this: any, ...args: any[]) {
            const start = performance.now()
            const record = () => nuxt._perf?.recordBundlerPluginHook(pluginName, hookName, performance.now() - start, start)
            try {
              const result = original.apply(this, args)
              if (result && typeof result === 'object' && 'then' in result) {
                return (result as Promise<any>).finally(record)
              }
              record()
              return result
            } catch (err) {
              record()
              throw err
            }
          } as any
        }
      }
    })
  }

  nuxt['~runtimeDependencies'] ||= []
  nuxt['~runtimeDependencies']!.push(
    ...runtimeDependencies,
    'unhead', '@unhead/vue', 'unstorage',
    // ensure we only have one version of vue if nitro is going to inline anyway
    ...nitro.options.inlineDynamicImports ? ['vue', '@vue/server-renderer'] : [],
  )

  addVitePlugin({
    name: 'nuxt:nitro:ssr-conditions',
    configEnvironment (name, config) {
      if (name === 'ssr') {
        config.resolve ||= {}
        config.resolve.conditions = getSsrResolveConditions(nitro.options.exportConditions)
      }
    },
  })

  addVitePlugin({
    name: 'nuxt:nitro:config',
    configEnvironment (name) {
      if (name === 'client') {
        return {
          optimizeDeps: {
            exclude: [
              'nitro/h3',
            ],
          },
        }
      }
    },
  })

  // Tree-shake Vue feature flags for non-node Nitro targets
  addVitePlugin({
    name: 'nuxt:nitro:vue-feature-flags',
    applyToEnvironment: environment => environment.name === 'ssr' && environment.config.isProduction,
    configResolved (config) {
      for (const key in config.define) {
        if (key.startsWith('__VUE')) {
          nitro.options.replace[key] = config.define[key]
        }
      }
    },
  })

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

  nitro.options.devHandlers.push(...nuxt.options.devServerHandlers)
  if (!nuxt.options.experimental.nitroViteEnvironment) {
    nitro.options.handlers.unshift({
      route: '/__nuxt_error',
      lazy: true,
      handler: resolve(distDir, 'runtime/handlers/renderer'),
    })
  }

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
      handler: defineEventHandler((event) => {
        // The response discloses the absolute project root and a stable workspace UUID, so
        // require a genuine loopback peer: `isLocalDevRequest` alone is forgeable by a
        // non-browser LAN client sending `Host: localhost`.
        if (!isLoopbackPeer(event) || !isLocalDevRequest(event, getDevHandlerAllowedHosts(nuxt))) {
          event.res.status = 403
          return 'Forbidden'
        }
        return {
          workspace: {
            ...projectConfiguration,
            root: nuxt.options.rootDir,
          },
        }
      }),
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

  // Nitro discovers file-based handlers by scanning, so they are only visible to Nuxt's typed
  // `$fetch` if reported here. Patterns are resolved through rou3, the router that will serve the
  // request, so the generated types and the routing cannot disagree about what a route matches.
  nuxt.hook('server:routes', (routes, context) => {
    context.requestTypes = {
      module: REQUEST_TYPES_MODULE,
      body: 'RequestBodyOf',
      query: 'RequestQueryOf',
      headers: 'RequestHeadersOf',
    }

    for (const handler of [...nitro.scannedHandlers, ...nitro.options.handlers]) {
      if (!handler.route) { continue }
      // an optional parameter matches with and without the segment, so it resolves to two routes
      for (const nodeKey of routeNodeKeys(handler.route)) {
        routes.push({
          segments: toRouteSegments(nodeKey),
          route: handler.route,
          method: handler.method,
          handler: handler.handler,
          middleware: handler.middleware,
        })
      }
    }
  })

  // Add typed route responses
  nuxt.hook('prepare:types', async (opts) => {
    // `tsconfig.server.json` maps `#imports` here, so it has to exist before anything resolves it
    await autoImports.writeTypes()
    opts.serverTsConfig.compilerOptions ||= {}
    opts.serverTsConfig.compilerOptions.paths ||= {}
    opts.serverTsConfig.compilerOptions.paths['#imports/server'] = [relativeWithDot(typesDir, autoImports.importsModulePath)]

    // `#imports/server` resolves in the app program too, so a handler importing from it still
    // yields a return type for the generated route types
    opts.tsConfig.compilerOptions ||= {}
    opts.tsConfig.compilerOptions.paths ||= {}
    opts.tsConfig.compilerOptions.paths['#imports/server'] = [relativeWithDot(typesDir, autoImports.importsModulePath)]
    // also referenced from the app program, which loads handler files regardless of its
    // `include`, because the generated route types name them with `typeof import(...)`
    opts.serverReferences.push({ path: autoImports.importsModulePath + '.d.ts' })
    opts.references.push({ path: autoImports.importsModulePath + '.d.ts' })

    // Exclude nitro output dir from typescript
    opts.tsConfig.exclude ||= []
    opts.tsConfig.exclude.push(relative(typesDir, resolve(nuxt.options.rootDir, nitro.options.output.dir)))

    opts.serverTsConfig.exclude ||= []
    opts.serverTsConfig.exclude.push(relative(typesDir, resolve(nuxt.options.rootDir, nitro.options.output.dir)))

    opts.serverReferences.push({ path: resolve(typesDir, 'types/nitro-nuxt.d.ts') })

    // only the aliases Nitro adds on top of `nuxt.options.alias`, which Nuxt maps itself
    opts.serverTsConfig.compilerOptions ||= {}
    opts.serverTsConfig.compilerOptions.paths ||= {}
    const serverPaths = opts.serverTsConfig.compilerOptions.paths
    // TODO: remove support for baseUrl in nuxt v5
    const serverBaseUrl = nuxt.options.future.compatibilityVersion >= 5
      ? undefined
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      : opts.serverTsConfig.compilerOptions.baseUrl
    const aliasBasePath = serverBaseUrl ? resolve(typesDir, serverBaseUrl) : typesDir
    for (const alias in nitro.options.alias) {
      if (alias in nuxt.options.alias || alias in serverPaths) { continue }
      if (excludedServerAlias.some(pattern => typeof pattern === 'string' ? alias === pattern : pattern.test(alias))) { continue }

      const target = nitro.options.alias[alias]!
      let absolutePath = resolve(aliasBasePath, target)
      let stats = await fsp.stat(absolutePath).catch(() => null /* file does not exist */)
      if (!stats) {
        const resolvedModule = resolveModulePath(target, {
          try: true,
          from: nuxt.options.modulesDir.map(d => pathToFileURL(withTrailingSlash(d))),
          extensions: [...nuxt.options.extensions, '.d.ts', '.d.mts', '.d.cts'],
        })
        if (resolvedModule) {
          absolutePath = resolvedModule
          stats = await fsp.stat(resolvedModule).catch(() => null)
        }
      }

      // left absolute: Nuxt relativises and strips the extension when it writes the config
      serverPaths[alias] = [absolutePath]
      if (target.endsWith('/') || stats?.isDirectory()) {
        serverPaths[`${alias}/*`] = [`${absolutePath}/*`]
      }
    }

    // the renderers import these app modules directly, so they resolve in the server program even
    // though `#app` as a whole does not
    const appDir = nuxt.options.alias['#app']
    if (appDir) {
      serverPaths['#app/island-hash'] ||= [resolve(appDir, 'island-hash')]
      serverPaths['#app/island-props'] ||= [resolve(appDir, 'island-props')]
      serverPaths['#app/internal/*'] ||= [resolve(appDir, 'internal/*')]
      serverPaths['#app/types'] ||= [resolve(appDir, 'types')]
    }

    // the generated route types import the request-shape extractors by package name, which the app
    // program cannot resolve on its own: this package is a dependency of `nuxt`, not of the project
    opts.tsConfig.compilerOptions ||= {}
    opts.tsConfig.compilerOptions.paths ||= {}
    opts.tsConfig.compilerOptions.paths[REQUEST_TYPES_MODULE] = [resolve(distDir, 'request-types')]

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
      for (const status of errorPages) {
        routes.add(`/${status}.html`)
      }
      if (!nuxt.options.ssr) {
        routes.add('/index.html')
      }
    })
  }

  if (nuxt.options.experimental.nitroViteEnvironment) {
    setupNitroViteEnvironment(nuxt, nitro)
  } else {
    setupLegacyDevAndBuild(nuxt, nitro)
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

function getDevHandlerAllowedHosts (nuxt: Nuxt): ReadonlySet<string> | true {
  const allowedHosts = nuxt.options.vite?.server?.allowedHosts
  if (allowedHosts === true) {
    return true
  }
  const hosts = new Set(LOOPBACK_HOSTS)
  if (Array.isArray(allowedHosts)) {
    for (const host of allowedHosts) {
      if (typeof host === 'string' && host) {
        hosts.add(host)
      }
    }
  }
  return hosts
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
    bundlerDiagnostics.NUXT_B7016({ path: nuxt.options.spaLoadingTemplate })
  }

  return ''
}

/**
 * Compile page route patterns into a static `NUXT_PAGE_MATCHER` matcher
 * declaration, so the renderer needs no runtime router construction.
 */
function compilePageMatcher (patterns: string[]): string {
  if (!patterns.length) {
    return 'const NUXT_PAGE_MATCHER = undefined'
  }
  const router = createRou3Router()
  for (const pattern of patterns) {
    addRou3Route(router, '', pattern, 1)
  }
  return compileRouterToString(router, 'NUXT_PAGE_MATCHER')
}

/**
 * Splits a rou3 node key, in which `*` marks a single matched segment and `**` the remaining
 * ones, into the segments Nuxt emits types from. Consecutive static parts are kept together so
 * the generated tree stays shallow.
 */
function toRouteSegments (nodeKey: string): ServerRouteSegment[] {
  const segments: ServerRouteSegment[] = []
  let staticValue = ''

  for (const part of nodeKey.split('/')) {
    if (!part) { continue }
    if (part !== '*' && part !== '**') {
      staticValue += `/${part}`
      continue
    }
    if (staticValue) {
      segments.push({ type: 'static', value: staticValue })
      staticValue = ''
    }
    segments.push(part === '*' ? { type: 'dynamic' } : { type: 'wildcard' })
  }

  if (staticValue) {
    segments.push({ type: 'static', value: staticValue })
  }

  return segments.length ? segments : [{ type: 'static', value: '/' }]
}
