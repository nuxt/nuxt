import { existsSync } from 'node:fs'
import { createBuilder, createServer, mergeConfig } from 'vite'
import * as vite from 'vite'
import { basename, dirname, join, resolve } from 'pathe'
import type { NuxtBuilder, ViteConfig } from '@nuxt/schema'
import { createIsIgnored, getLayerDirectories, logger, resolvePath, useNitro } from '@nuxt/kit'
import { sanitizeFilePath } from 'mlly'
import viteJsxPlugin from '@vitejs/plugin-vue-jsx'
import vuePlugin from '@vitejs/plugin-vue'
import escapeStringRegexp from 'escape-string-regexp'
import { joinURL, withTrailingSlash, withoutLeadingSlash } from 'ufo'
import { filename } from 'pathe/utils'
import { resolveModulePath } from 'exsolve'

import { resolveCSSOptions } from './css'
import { createViteLogger, logLevelMap } from './utils/logger'
import { transpile } from './utils/transpile'

import { SSRStylesPlugin } from './plugins/ssr-styles'
import { PublicDirsPlugin } from './plugins/public-dirs'
import { distDir } from './dirs'
import { VueFeatureFlagsPlugin } from './plugins/vue-feature-flags'
import { SourcemapPreserverPlugin } from './plugins/sourcemap-preserver'
import { DevStyleSSRPlugin } from './plugins/dev-style-ssr'
import { RuntimePathsPlugin } from './plugins/runtime-paths'
import { TypeCheckPlugin } from './plugins/type-check'
import { ModulePreloadPolyfillPlugin } from './plugins/module-preload-polyfill'
import { StableEntryPlugin } from './plugins/stable-entry'
import { LayerDepOptimizePlugin } from './plugins/layer-dep-optimize'
import { VitePluginCheckerPlugin } from './plugins/vite-plugin-checker'
import { AnalyzePlugin } from './plugins/analyze'
import { ReplacePlugin } from './plugins/replace'
import { DevServerPlugin } from './plugins/dev-server'
import { EnvironmentsPlugin } from './plugins/environments'
import { ViteNodePlugin, writeDevServer } from './plugins/vite-node'
import { ClientManifestPlugin } from './plugins/client-manifest'

export const bundle: NuxtBuilder['bundle'] = async (nuxt) => {
  const useAsyncEntry = nuxt.options.experimental.asyncEntry || nuxt.options.dev
  const entry = await resolvePath(resolve(nuxt.options.appDir, useAsyncEntry ? 'entry.async' : 'entry'))

  nuxt.options.modulesDir.push(distDir)

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

  // @ts-expect-error non-public property
  if (vite.rolldownVersion) {
    // esbuild is not used in `rolldown-vite`
    if (viteConfig.esbuild) {
      delete viteConfig.esbuild
    }
    if (viteConfig.optimizeDeps?.esbuildOptions) {
      delete viteConfig.optimizeDeps.esbuildOptions
    }
  }

  const mockEmpty = resolveModulePath('mocked-exports/empty', { from: import.meta.url })

  const helper = nuxt.options.nitro.imports !== false ? '' : 'globalThis.'

  const isIgnored = createIsIgnored(nuxt)
  const serverEntry = nuxt.options.ssr ? entry : await resolvePath(resolve(nuxt.options.appDir, 'entry-spa'))
  const config: vite.InlineConfig = mergeConfig(
    {
      base: nuxt.options.dev ? joinURL(nuxt.options.app.baseURL.replace(/^\.\//, '/') || '/', nuxt.options.app.buildAssetsDir) : undefined,
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
            await builder.build(environment)
            logger.wrapAll()
            await nuxt.callHook('vite:compiled')
          }
        },
      },
      environments: {
        client: {
          consumer: 'client',
          keepProcessEnv: false,
          optimizeDeps: {
            entries: [entry],
            // We exclude Vue and Nuxt common dependencies from optimization
            // as they already ship ESM.
            //
            // This will help to reduce the chance for users to encounter
            // common chunk conflicts that causing browser reloads.
            // We should also encourage module authors to add their deps to
            // `exclude` if they ships bundled ESM.
            //
            // Also since `exclude` is inert, it's safe to always include
            // all possible deps even if they are not used yet.
            //
            // @see https://github.com/antfu/nuxt-better-optimize-deps#how-it-works
            exclude: [
              // Vue
              'vue',
              '@vue/runtime-core',
              '@vue/runtime-dom',
              '@vue/reactivity',
              '@vue/shared',
              '@vue/devtools-api',
              'vue-router',
              'vue-demi',

              // Nuxt
              'nuxt',
              'nuxt/app',

              // Nuxt Deps
              '@unhead/vue',
              'consola',
              'defu',
              'devalue',
              'h3',
              'hookable',
              'klona',
              'ofetch',
              'pathe',
              'ufo',
              'unctx',
              'unenv',

              // these will never be imported on the client
              '#app-manifest',
            ],
          },
          define: {
            'process.env.NODE_ENV': JSON.stringify(viteConfig.mode),
            'process.server': false,
            'process.client': true,
            'process.browser': true,
            'process.nitro': false,
            'process.prerender': false,
            'import.meta.server': false,
            'import.meta.client': true,
            'import.meta.browser': true,
            'import.meta.nitro': false,
            'import.meta.prerender': false,
            'module.hot': false,
            ...nuxt.options.experimental.clientNodeCompat ? { global: 'globalThis' } : {},
          },
          build: {
            sourcemap: nuxt.options.sourcemap.client ? viteConfig.build?.sourcemap ?? nuxt.options.sourcemap.client : false,
            manifest: 'manifest.json',
            outDir: resolve(nuxt.options.buildDir, 'dist/client'),
            rollupOptions: {
              input: { entry },
            },
          },
          dev: {
            warmup: [entry],
          },
        },
        ssr: {
          consumer: 'server',
          build: {
            // we'll display this in nitro build output
            reportCompressedSize: false,
            sourcemap: nuxt.options.sourcemap.server ? viteConfig.build?.sourcemap ?? nuxt.options.sourcemap.server : false,
            outDir: resolve(nuxt.options.buildDir, 'dist/server'),
            ssr: true,
            rollupOptions: {
              input: { server: serverEntry },
              external: [
                'nitro/runtime',
                // TODO: remove in v5
                '#internal/nitro',
                'nitropack/runtime',
                '#internal/nuxt/paths',
                '#internal/nuxt/app-config',
                '#app-manifest',
                '#shared',
                new RegExp('^' + escapeStringRegexp(withTrailingSlash(resolve(nuxt.options.rootDir, nuxt.options.dir.shared)))),
              ],
              output: {
                entryFileNames: '[name].mjs',
                format: 'module',

                // @ts-expect-error non-public property
                ...(vite.rolldownVersion
                // Wait for https://github.com/rolldown/rolldown/issues/206
                  ? {}
                  : {
                      generatedCode: {
                        symbols: true, // temporary fix for https://github.com/vuejs/core/issues/8351,
                        constBindings: true,
                        // temporary fix for https://github.com/rollup/rollup/issues/5975
                        arrowFunctions: true,
                      },
                    }),
              },
              onwarn (warning, rollupWarn) {
                if (warning.code && 'UNUSED_EXTERNAL_IMPORT' === warning.code) {
                  return
                }
                rollupWarn(warning)
              },
            },
          },
          define: {
            'process.server': true,
            'process.client': false,
            'process.browser': false,
            'import.meta.server': true,
            'import.meta.client': false,
            'import.meta.browser': false,
            'window': 'undefined',
            'document': 'undefined',
            'navigator': 'undefined',
            'location': 'undefined',
            'XMLHttpRequest': 'undefined',
          },
          resolve: {
            conditions: useNitro().options.exportConditions,
          },
          dev: {
            warmup: [serverEntry],
          },
        },
      },
      ssr: {
        external: [
          'nitro/runtime',
          // TODO: remove in v5
          '#internal/nitro',
          '#internal/nitro/utils',
        ],
        noExternal: [
          ...transpile({ isServer: true, isDev: nuxt.options.dev }),
          '/__vue-jsx',
          '#app',
          /^nuxt(\/|$)/,
          /(nuxt|nuxt3|nuxt-nightly)\/(dist|src|app)/,
        ],
      },
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
      css: {
        // TODO: devSourcemap
        ...await resolveCSSOptions(nuxt),
      },
      define: {
        __NUXT_VERSION__: JSON.stringify(nuxt._version),
        __NUXT_ASYNC_CONTEXT__: nuxt.options.experimental.asyncContext,
      },
      build: {
        copyPublicDir: false,
        rollupOptions: {
          output: {
            sourcemapIgnoreList: (relativeSourcePath) => {
              return relativeSourcePath.includes('node_modules') || relativeSourcePath.includes(nuxt.options.buildDir)
            },
            sanitizeFileName: sanitizeFilePath,
            // https://github.com/vitejs/vite/tree/main/packages/vite/src/node/build.ts#L464-L478
            assetFileNames: nuxt.options.dev
              ? undefined
              : chunk => withoutLeadingSlash(join(nuxt.options.app.buildAssetsDir, `${sanitizeFilePath(filename(chunk.names[0]!))}.[hash].[ext]`)),
          },
        },

        // @ts-expect-error non-public property
        watch: (vite.rolldownVersion
          // TODO: https://github.com/rolldown/rolldown/issues/5799 for ignored fn
          ? { exclude: [...nuxt.options.ignore, /[\\/]node_modules[\\/]/] }
          : {
              chokidar: { ...nuxt.options.watchers.chokidar, ignored: [isIgnored, /[\\/]node_modules[\\/]/] },
              exclude: nuxt.options.ignore,
            }
        ),
      },
      plugins: [
        vuePlugin(viteConfig.vue),
        viteJsxPlugin(viteConfig.vueJsx),
        ViteNodePlugin(nuxt),
        ClientManifestPlugin(nuxt),
        EnvironmentsPlugin(nuxt),
        DevServerPlugin(nuxt),
        ReplacePlugin(),
        SSRStylesPlugin(nuxt),
        LayerDepOptimizePlugin(nuxt),
        // add resolver for files in public assets directories
        PublicDirsPlugin({
          dev: nuxt.options.dev,
          baseURL: nuxt.options.app.baseURL,
        }),
        // Add type-checking
        VitePluginCheckerPlugin(nuxt),

        // server-only plugins
        VueFeatureFlagsPlugin(nuxt),
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

  const ctx = { nuxt, entry, config }
  await nuxt.callHook('vite:extend', ctx)

  config.customLogger = createViteLogger(config)
  config.configFile = false

  for (const environment of ['client', 'ssr']) {
    const environments = { [environment]: config.environments![environment]! }
    const strippedConfig = { ...config, environments }
    const ctx = { isServer: environment === 'ssr', isClient: environment === 'client' }
    await nuxt.hooks.callHook('vite:extendConfig', strippedConfig, ctx)
    await nuxt.hooks.callHook('vite:configResolved', strippedConfig, ctx)
  }

  if (!nuxt.options.dev) {
    const builder = await createBuilder(config)
    await builder.buildApp()
    return
  }

  await withLogs(async () => {
    const server = await createServer(config)
    await server.environments.ssr.pluginContainer.buildStart({})
  }, 'Vite dev server built')

  await writeDevServer(nuxt)
}

async function withLogs (fn: () => Promise<unknown>, message: string, enabled = true) {
  if (!enabled) { return fn() }

  const start = performance.now()
  await fn()
  const duration = performance.now() - start
  logger.success(`${message} in ${Math.round(duration)}ms`)
}
