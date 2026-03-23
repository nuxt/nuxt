import { existsSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { createBuilder, createServer, mergeConfig } from 'vite'
import type * as vite from 'vite'
import { basename, dirname, join, resolve } from 'pathe'
import type { NuxtBuilder, ViteConfig } from '@nuxt/schema'
import { createIsIgnored, getLayerDirectories, logger, resolvePath, useNitro } from '@nuxt/kit'
import { sanitizeFilePath } from 'mlly'
import vuePlugin from '@vitejs/plugin-vue'
import { joinURL, withTrailingSlash, withoutLeadingSlash } from 'ufo'
import { filename } from 'pathe/utils'
import { resolveModulePath } from 'exsolve'

import { ssr, ssrEnvironment } from './shared/server.ts'
import { clientEnvironment } from './shared/client.ts'
import { resolveCSSOptions } from './css.ts'
import { createViteLogger, logLevelMap } from './utils/logger.ts'
import { OptimizeDepsHintPlugin, optimizerCallbacks, userOptimizeDepsInclude } from './plugins/optimize-deps-hint.ts'

import { VueJsxPlugin } from './plugins/vue-jsx.ts'
import { SSRStylesPlugin } from './plugins/ssr-styles.ts'
import { PublicDirsPlugin } from './plugins/public-dirs.ts'
import { ReplacePlugin } from './plugins/replace.ts'
import { LayerDepOptimizePlugin } from './plugins/layer-dep-optimize.ts'
import { distDir } from './dirs.ts'
import { SourcemapPreserverPlugin } from './plugins/sourcemap-preserver.ts'
import { DevStyleSSRPlugin } from './plugins/dev-style-ssr.ts'
import { DecoratorsPlugin } from './plugins/decorators.ts'
import { RuntimePathsPlugin } from './plugins/runtime-paths.ts'
import { TypeCheckPlugin } from './plugins/type-check.ts'
import { ModulePreloadPolyfillPlugin } from './plugins/module-preload-polyfill.ts'
import { StableEntryPlugin } from './plugins/stable-entry.ts'
import { VitePluginCheckerPlugin } from './plugins/vite-plugin-checker.ts'
import { AnalyzePlugin } from './plugins/analyze.ts'
import { DevServerPlugin } from './plugins/dev-server.ts'
import { EnvironmentsPlugin } from './plugins/environments.ts'
import { ViteNodePlugin } from './plugins/vite-node.ts'
import { ClientManifestPlugin } from './plugins/client-manifest.ts'
import { ResolveDeepImportsPlugin } from './plugins/resolve-deep-imports.ts'
import { ResolveExternalsPlugin } from './plugins/resolved-externals.ts'
import { PerfPlugin } from './plugins/perf.ts'

export const bundle: NuxtBuilder['bundle'] = async (nuxt) => {
  const useAsyncEntry = nuxt.options.experimental.asyncEntry || nuxt.options.dev
  const entry = await resolvePath(resolve(nuxt.options.appDir, useAsyncEntry ? 'entry.async' : 'entry'))

  nuxt.options.modulesDir.push(distDir)

  // Register Nitro plugin to fix SSR error stacktraces in dev mode
  if (nuxt.options.dev) {
    const nitro = useNitro()
    nitro.options.virtual['#internal/nitro/ssr-stacktrace'] = `export { default } from ${JSON.stringify(resolve(distDir, 'fix-stacktrace'))}`
    nitro.options.plugins.push('#internal/nitro/ssr-stacktrace')
    nitro.options.alias['#vite-node'] = resolve(distDir, 'vite-node')
    nitro.options.virtual['#internal/nuxt/vite-node-runner'] = () => `export { default } from ${JSON.stringify(resolve(distDir, 'vite-node-runner'))}`
  }

  let allowDirs = [
    nuxt.options.appDir,
    nuxt.options.workspaceDir,
    ...nuxt.options.modulesDir,
    ...getLayerDirectories(nuxt).map(d => d.root),
    ...Object.values(nuxt.apps).flatMap(app => [
      ...app.components.map(c => dirname(c.filePath)),
      ...app.plugins.map(p => dirname(p.src)),
      ...app.middleware.map(m => dirname(m.path)),
      ...Object.values(app.layouts || {}).map(l => dirname(l.file)),
      dirname(nuxt.apps.default!.rootComponent!),
      dirname(nuxt.apps.default!.errorComponent!),
    ]),
  ].filter(d => d && existsSync(d))

  for (const dir of allowDirs) {
    allowDirs = allowDirs.filter(d => !d.startsWith(dir) || d === dir)
  }

  const { $client, $server, ...viteConfig } = nuxt.options.vite

  const mockEmpty = resolveModulePath('mocked-exports/empty', { from: import.meta.url })

  const helper = nuxt.options.nitro.imports !== false ? '' : 'globalThis.'

  const isIgnored = createIsIgnored(nuxt)
  const serverEntry = nuxt.options.ssr ? entry : await resolvePath(resolve(nuxt.options.appDir, 'entry-spa'))
  const config: vite.InlineConfig = mergeConfig(
    {
      base: nuxt.options.dev
        ? joinURL(nuxt.options.app.baseURL.replace(/^\.\//, '/') || '/', nuxt.options.app.buildAssetsDir)
        : undefined,
      logLevel: logLevelMap[nuxt.options.logLevel] ?? logLevelMap.info,
      experimental: {
        renderBuiltUrl: (filename, { type, hostType, ssr }) => {
          if (hostType !== 'js') {
            // In CSS we only use relative paths until we craft a clever runtime CSS hack
            return { relative: true }
          }
          if (!ssr) {
            if (type === 'asset') {
              return { relative: true }
            }
            return { runtime: `globalThis.__publicAssetsURL(${JSON.stringify(filename)})` }
          }
          if (type === 'public') {
            return { runtime: `${helper}__publicAssetsURL(${JSON.stringify(filename)})` }
          }
          if (type === 'asset') {
            const relativeFilename = filename.replace(withTrailingSlash(withoutLeadingSlash(nuxt.options.app.buildAssetsDir)), '')
            return { runtime: `${helper}__buildAssetsURL(${JSON.stringify(relativeFilename)})` }
          }
        },
      },
      builder: {
        async buildApp (builder) {
          // run serially to preserve the order of client, server builds
          const environments = Object.values(builder.environments)
          for (const environment of environments) {
            logger.restoreAll()
            nuxt._perf?.startPhase(`vite:${environment.name}`)
            await builder.build(environment)
            nuxt._perf?.endPhase(`vite:${environment.name}`)
            logger.wrapAll()
            await nuxt.callHook('vite:compiled')
          }
        },
      },
      environments: {
        client: {
          consumer: 'client',
          keepProcessEnv: false,
          dev: {
            warmup: [entry],
          },
          ...clientEnvironment(nuxt, entry),
        },
        ssr: {
          consumer: 'server',
          dev: {
            warmup: [serverEntry],
          },
          ...ssrEnvironment(nuxt, serverEntry),
        },
      },
      ssr: ssr(nuxt),
      resolve: {
        alias: {
          [basename(nuxt.options.dir.assets)]: resolve(nuxt.options.srcDir, nuxt.options.dir.assets),
          ...nuxt.options.alias,
          '#app': nuxt.options.appDir,
          'web-streams-polyfill/ponyfill/es2018': mockEmpty,
          // Cannot destructure property 'AbortController' of ..
          'abort-controller': mockEmpty,
        },
        dedupe: [
          'vue',
        ],
      },
      // TODO: devSourcemap
      css: await resolveCSSOptions(nuxt),
      define: {
        __NUXT_VERSION__: JSON.stringify(nuxt._version),
        __NUXT_ASYNC_CONTEXT__: nuxt.options.experimental.asyncContext,
      },
      build: {
        copyPublicDir: false,
        rolldownOptions: {
          output: {
            sourcemapIgnoreList: (relativeSourcePath) => {
              return relativeSourcePath.includes('node_modules') || relativeSourcePath.includes(nuxt.options.buildDir)
            },
            sanitizeFileName: sanitizeFilePath,
            // https://github.com/vitejs/vite/blob/main/packages/vite/src/node/build.ts#L464-L478
            assetFileNames: nuxt.options.dev
              ? undefined
              : chunk => withoutLeadingSlash(join(nuxt.options.app.buildAssetsDir, `${sanitizeFilePath(filename(chunk.names[0]!))}.[hash].[ext]`)),
          },
        },

        // TODO: https://github.com/rolldown/rolldown/issues/5799 for ignored fn
        watch: { exclude: [...nuxt.options.ignore, /[\\/]node_modules[\\/]/] },
      },
      plugins: [
        // per-plugin timing when profiling is enabled
        PerfPlugin(nuxt),
        // add resolver for modules used in virtual files
        ResolveDeepImportsPlugin(nuxt),
        ResolveExternalsPlugin(nuxt),
        vuePlugin(viteConfig.vue),
        ...VueJsxPlugin(nuxt, viteConfig.vueJsx),
        ViteNodePlugin(nuxt),
        ClientManifestPlugin(nuxt),
        DevServerPlugin(nuxt),
        // lower decorators after Vue SFC compilation and TypeScript stripping
        DecoratorsPlugin(nuxt),
        // add resolver for files in public assets directories
        PublicDirsPlugin({
          dev: nuxt.options.dev,
          baseURL: nuxt.options.app.baseURL,
        }),
        ReplacePlugin(),
        LayerDepOptimizePlugin(nuxt),
        SSRStylesPlugin(nuxt),
        EnvironmentsPlugin(nuxt),
        // Add type-checking
        VitePluginCheckerPlugin(nuxt),
        // tell rollup's nitro build about the original sources of the generated vite server build
        SourcemapPreserverPlugin(nuxt),
        // client-only plugins
        DevStyleSSRPlugin({
          srcDir: nuxt.options.srcDir,
          buildAssetsURL: joinURL(nuxt.options.app.baseURL, nuxt.options.app.buildAssetsDir),
        }),
        RuntimePathsPlugin(),
        // Type checking client panel
        TypeCheckPlugin(nuxt),
        ModulePreloadPolyfillPlugin(),
        // ensure changes in chunks do not invalidate whole build
        StableEntryPlugin(nuxt),
        AnalyzePlugin(nuxt),
        OptimizeDepsHintPlugin(nuxt),
      ],
      appType: 'custom',
      server: {
        middlewareMode: true,
        watch: { ...nuxt.options.watchers.chokidar, ignored: [isIgnored, /[\\/]node_modules[\\/]/] },
        fs: {
          allow: [...new Set(allowDirs)],
        },
      },
    } satisfies ViteConfig,
    {
      ...viteConfig,
      environments: {
        ssr: $server,
        client: $client,
      },
    },
  )

  // In build mode we explicitly override any vite options that vite is relying on
  // to detect whether to inject production or development code (such as HMR code)
  if (!nuxt.options.dev) {
    config.server!.watch = undefined
    config.build!.watch = undefined
  }

  userOptimizeDepsInclude.set(nuxt, [...((config.optimizeDeps?.include as string[]) || [])])

  const ctx = { nuxt, entry, config: config as ViteConfig }
  await nuxt.callHook('vite:extend', ctx)

  const callbacks = optimizerCallbacks.get(nuxt)
  config.customLogger = createViteLogger(config, { onNewDeps: callbacks?.onNewDeps, onStaleDep: callbacks?.onStaleDep })
  config.configFile = false

  for (const environment of ['client', 'ssr']) {
    const environments = { [environment]: config.environments![environment]! }
    const strippedConfig = { ...config, environments } as ViteConfig
    const ctx = { isServer: environment === 'ssr', isClient: environment === 'client' }
    await nuxt.hooks.callHook('vite:extendConfig', strippedConfig, ctx)
    await nuxt.hooks.callHook('vite:configResolved', strippedConfig, ctx)
  }

  if (!nuxt.options.dev) {
    const builder = await createBuilder(config)
    await builder.buildApp()
    return
  }

  nuxt._perf?.startPhase('vite:dev-server')
  await withLogs(async () => {
    const server = await createServer(config)
    await server.environments.ssr.pluginContainer.buildStart({})
  }, 'Vite dev server built')
  nuxt._perf?.endPhase('vite:dev-server')
}

async function withLogs (fn: () => Promise<unknown>, message: string, enabled = true) {
  if (!enabled) { return fn() }

  const start = performance.now()
  await fn()
  const duration = performance.now() - start
  logger.success(`${message} in ${Math.round(duration)}ms`)
}
