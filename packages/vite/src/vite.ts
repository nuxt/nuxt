import { existsSync } from 'node:fs'
import { createBuilder, createServer, mergeConfig as mergeViteConfig } from 'vite'
import type { EnvironmentOptions, ViteDevServer } from 'vite'
import { basename, dirname, join, resolve } from 'pathe'
import type { Nuxt, NuxtBuilder, ViteConfig } from '@nuxt/schema'
import { createIsIgnored, logger, resolvePath, useNitro } from '@nuxt/kit'
import { sanitizeFilePath } from 'mlly'
import { joinURL, withTrailingSlash, withoutLeadingSlash } from 'ufo'
import { filename } from 'pathe/utils'
import { resolveModulePath } from 'exsolve'
import type { Nitro } from 'nitropack/types'
import escapeStringRegexp from 'escape-string-regexp'
import vuePlugin from '@vitejs/plugin-vue'
import vueJsxPlugin from '@vitejs/plugin-vue-jsx'
import { defu } from 'defu'

import { warmupViteServer } from './utils/warmup'
import { resolveCSSOptions } from './css'
import { createViteLogger, logLevelMap } from './utils/logger'
import { SSRStylesPlugin } from './plugins/ssr-styles'
import { PublicDirsPlugin } from './plugins/public-dirs'
import { distDir } from './dirs'
import { VueFeatureFlagsPlugin } from './plugins/vue-feature-flags'
import { SourcemapPreserverPlugin } from './plugins/sourcemap-preserver'
import { DevStyleSSRPlugin } from './plugins/dev-style-ssr'
import { RuntimePathsPlugin } from './plugins/runtime-paths'
import { ViteNodePlugin } from './vite-node'
import { TypeCheckPlugin } from './plugins/type-check'
import { ModulePreloadPolyfillPlugin } from './plugins/module-preload-polyfill'
import { AnalyzePlugin } from './plugins/analyze'
import { transpile } from './utils/transpile'
import { ReplacePlugin } from './plugins/replace'
import { LayerDepOptimizePlugin } from './plugins/layer-dep-optimize'
import { VitePluginCheckerPlugin } from './plugins/checker'
import { ClientManifestPlugin } from './plugins/client-manifest'
import { DevServerPlugin } from './plugins/dev-server'
import { EnvironmentsPlugin } from './plugins/environments'

export interface ViteBuildContext {
  nuxt: Nuxt
  config: ViteConfig
  entry: string
  clientServer?: ViteDevServer
  ssrServer?: ViteDevServer
}

export const bundle: NuxtBuilder['bundle'] = async (nuxt) => {
  const useAsyncEntry = nuxt.options.experimental.asyncEntry || nuxt.options.dev
  const entry = await resolvePath(resolve(nuxt.options.appDir, useAsyncEntry ? 'entry.async' : 'entry'))
  const serverEntry = nuxt.options.ssr ? entry : await resolvePath(resolve(nuxt.options.appDir, 'entry-spa'))

  nuxt.options.modulesDir.push(distDir)

  let allowDirs = [
    nuxt.options.appDir,
    nuxt.options.workspaceDir,
    ...nuxt.options.modulesDir,
    ...nuxt.options._layers.map(l => l.config.rootDir),
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
  const config = mergeViteConfig(
      {
        base: nuxt.options.dev
          ? joinURL(nuxt.options.app.baseURL.replace(/^\.\//, '/') || '/', nuxt.options.app.buildAssetsDir)
          : undefined, // TODO: do we need `./` for server?
        css: {
          devSourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client,
        },
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
          client: mergeViteConfig({
            define: {
              'process.env.NODE_ENV': JSON.stringify(nuxt.options.dev ? 'development' : 'production'),
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
            optimizeDeps: {
              entries: [entry],
              include: [],
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
            build: {
              manifest: 'manifest.json',
              outDir: resolve(nuxt.options.buildDir, 'dist/client'),
              rollupOptions: {
                input: { entry },
              },
            },
            dev: {
              warmup: [entry],
            },
          } satisfies EnvironmentOptions, nuxt.options.vite.$client || {}) as EnvironmentOptions,

          ssr: defu({
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
            optimizeDeps: {
              noDiscovery: true,
            },
            resolve: {
              conditions: ((nuxt as any)._nitro as Nitro)?.options.exportConditions,
            },
            build: {
              // we'll display this in nitro build output
              reportCompressedSize: false,
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
                  generatedCode: {
                    symbols: true, // temporary fix for https://github.com/vuejs/core/issues/8351,
                    constBindings: true,
                    // temporary fix for https://github.com/rollup/rollup/issues/5975
                    arrowFunctions: true,
                  },
                },
                onwarn (warning, rollupWarn) {
                  if (warning.code && 'UNUSED_EXTERNAL_IMPORT' === warning.code) {
                    return
                  }
                  rollupWarn(warning)
                },
              },
            },
            dev: {
              warmup: [serverEntry],
              // https://github.com/vitest-dev/vitest/issues/229#issuecomment-1002685027
              preTransformRequests: false,
            },
          } satisfies EnvironmentOptions, nuxt.options.vite.$server || {}) as EnvironmentOptions,
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
        css: await resolveCSSOptions(nuxt),
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
          watch: {
            chokidar: { ...nuxt.options.watchers.chokidar, ignored: [isIgnored, /[\\/]node_modules[\\/]/] },
            exclude: nuxt.options.ignore,
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
        plugins: [
          // TODO: allow customising options after vite hooks
          vuePlugin(nuxt.options.vite.vue),
          vueJsxPlugin(nuxt.options.vite.vueJsx),
          DevServerPlugin(nuxt),
          ClientManifestPlugin(nuxt),
          SSRStylesPlugin(nuxt),
          ReplacePlugin(),
          LayerDepOptimizePlugin(nuxt),
          EnvironmentsPlugin(nuxt),
          // Add type-checking
          VitePluginCheckerPlugin(nuxt),
          // add resolver for files in public assets directories
          PublicDirsPlugin({
            dev: nuxt.options.dev,
            baseURL: nuxt.options.app.baseURL,
          }),
          // server plugins
          VueFeatureFlagsPlugin(nuxt),
          SourcemapPreserverPlugin(nuxt), // tell rollup's nitro build about the original sources of the generated vite server build
          // client plugins
          DevStyleSSRPlugin({
            srcDir: nuxt.options.srcDir,
            buildAssetsURL: joinURL(nuxt.options.app.baseURL, nuxt.options.app.buildAssetsDir),
          }),
          RuntimePathsPlugin(),
          ViteNodePlugin(nuxt),
          // Type checking client panel
          TypeCheckPlugin(nuxt),
          ModulePreloadPolyfillPlugin(),
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
      viteConfig,
  )

  // In build mode we explicitly override any vite options that vite is relying on
  // to detect whether to inject production or development code (such as HMR code)
  if (!nuxt.options.dev) {
    config.server!.watch = undefined
    config.build!.watch = undefined
  }

  const ctx = { nuxt, config, entry }

  await nuxt.callHook('vite:extend', ctx)

  config.customLogger = createViteLogger(config)

  nuxt.hook('vite:serverCreated', (server: ViteDevServer) => {
    // Invalidate virtual modules when templates are re-generated
    nuxt.hook('app:templatesGenerated', async (_app, changedTemplates) => {
      await Promise.all(changedTemplates.map(async (template) => {
        for (const mod of server.moduleGraph.getModulesByFile(`virtual:nuxt:${encodeURIComponent(template.dst)}`) || []) {
          server.moduleGraph.invalidateModule(mod)
          await server.reloadModule(mod)
        }
      }))
    })

    if (nuxt.options.vite.warmupEntry !== false) {
      // Don't delay nitro build for warmup
      useNitro().hooks.hookOnce('compiled', () => {
        const start = Date.now()
        warmupViteServer(server, [entry, serverEntry])
          .then(() => logger.info(`Vite dev server warmed up in ${Date.now() - start}ms`))
          .catch(logger.error)
      })
    }
  })

  if (!nuxt.options.dev) {
    config.configFile = false
    const builder = await createBuilder(config)
    await builder.buildApp()
    return
  }

  await withLogs(() => createServer(config), 'Vite dev server built')
}

async function withLogs (fn: () => Promise<any>, message: string, enabled = true) {
  if (!enabled) { return fn() }

  const start = performance.now()
  await fn()
  const duration = performance.now() - start
  logger.success(`${message} in ${Math.round(duration)}ms`)
}
