import { existsSync } from 'node:fs'
import * as vite from 'vite'
import { basename, dirname, join, normalize, resolve } from 'pathe'
import type { Nuxt, NuxtBuilder, ViteConfig } from '@nuxt/schema'
import { addVitePlugin, createIsIgnored, logger, resolvePath, useNitro } from '@nuxt/kit'
import replace from '@rollup/plugin-replace'
import type { RollupReplaceOptions } from '@rollup/plugin-replace'
import { sanitizeFilePath } from 'mlly'
import { withTrailingSlash, withoutLeadingSlash } from 'ufo'
import { filename } from 'pathe/utils'
import { resolveTSConfig } from 'pkg-types'
import { resolveModulePath } from 'exsolve'
import type { Nitro } from 'nitro/types'
import escapeStringRegexp from 'escape-string-regexp'

import { buildClient } from './client'
import { buildServer } from './server'
import { warmupViteServer } from './utils/warmup'
import { resolveCSSOptions } from './css'
import { logLevelMap } from './utils/logger'
import { SSRStylesPlugin } from './plugins/ssr-styles'
import { PublicDirsPlugin } from './plugins/public-dirs'
import { distDir } from './dirs'

export interface ViteBuildContext {
  nuxt: Nuxt
  config: ViteConfig
  entry: string
  clientServer?: vite.ViteDevServer
  ssrServer?: vite.ViteDevServer
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
  const ctx: ViteBuildContext = {
    nuxt,
    entry,
    config: vite.mergeConfig(
      {
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
        environments: {
          client: {
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
          },

          ssr: {
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
          },
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
        plugins: [
          // add resolver for files in public assets directories
          PublicDirsPlugin({
            dev: nuxt.options.dev,
            baseURL: nuxt.options.app.baseURL,
          }),
        ],
        server: {
          watch: { ...nuxt.options.watchers.chokidar, ignored: [isIgnored, /[\\/]node_modules[\\/]/] },
          fs: {
            allow: [...new Set(allowDirs)],
          },
        },
      } satisfies ViteConfig,
      viteConfig,
    ),
  }

  // In build mode we explicitly override any vite options that vite is relying on
  // to detect whether to inject production or development code (such as HMR code)
  if (!nuxt.options.dev) {
    ctx.config.server!.watch = undefined
    ctx.config.build!.watch = undefined
  }

  // TODO: this may no longer be needed with most recent vite version
  if (nuxt.options.dev) {
    // Identify which layers will need to have an extra resolve step.
    const layerDirs: string[] = []
    const delimitedRootDir = nuxt.options.rootDir + '/'
    for (const layer of nuxt.options._layers) {
      if (layer.config.srcDir !== nuxt.options.srcDir && !layer.config.srcDir.startsWith(delimitedRootDir)) {
        layerDirs.push(layer.config.srcDir + '/')
      }
    }
    if (layerDirs.length > 0) {
      // Reverse so longest/most specific directories are searched first
      layerDirs.sort().reverse()
      nuxt.hook('vite:extendConfig', (config) => {
        const dirs = [...layerDirs]
        config.plugins!.push({
          name: 'nuxt:optimize-layer-deps',
          enforce: 'pre',
          async resolveId (source, _importer) {
            if (!_importer || !dirs.length) { return }
            const importer = normalize(_importer)
            const layerIndex = dirs.findIndex(dir => importer.startsWith(dir))
            // Trigger vite to optimize dependencies imported within a layer, just as if they were imported in final project
            if (layerIndex !== -1) {
              dirs.splice(layerIndex, 1)
              await this.resolve(source, join(nuxt.options.srcDir, 'index.html'), { skipSelf: true }).catch(() => null)
            }
          },
        })
      })
    }
  }

  // Add type-checking
  if (!nuxt.options.test && (nuxt.options.typescript.typeCheck === true || (nuxt.options.typescript.typeCheck === 'build' && !nuxt.options.dev))) {
    const checker = await import('vite-plugin-checker').then(r => r.default)
    addVitePlugin(checker({
      vueTsc: {
        tsconfigPath: await resolveTSConfig(nuxt.options.rootDir),
      },
    }), { server: nuxt.options.ssr })
  }

  await nuxt.callHook('vite:extend', ctx)

  nuxt.hook('vite:extendConfig', (config) => {
    const replaceOptions: RollupReplaceOptions = Object.create(null)
    replaceOptions.preventAssignment = true

    for (const key in config.define!) {
      if (key.startsWith('import.meta.')) {
        replaceOptions[key] = config.define![key]
      }
    }

    config.plugins!.push(replace(replaceOptions))
  })

  if (!nuxt.options.dev) {
    const chunksWithInlinedCSS = new Set<string>()
    const clientCSSMap = {}

    nuxt.hook('vite:extendConfig', (config, { isServer }) => {
      config.plugins!.unshift(SSRStylesPlugin({
        srcDir: nuxt.options.srcDir,
        clientCSSMap,
        chunksWithInlinedCSS,
        shouldInline: nuxt.options.features.inlineStyles,
        components: nuxt.apps.default!.components || [],
        globalCSS: nuxt.options.css,
        mode: isServer ? 'server' : 'client',
        entry: ctx.entry,
      }))
    })

    // Remove CSS entries for files that will have inlined styles
    nuxt.hook('build:manifest', (manifest) => {
      for (const [key, entry] of Object.entries(manifest)) {
        const shouldRemoveCSS = chunksWithInlinedCSS.has(key) && !entry.isEntry
        if (entry.isEntry && chunksWithInlinedCSS.has(key)) {
          // @ts-expect-error internal key
          entry._globalCSS = true
        }
        if (shouldRemoveCSS && entry.css) {
          entry.css = []
        }
      }
    })
  }

  nuxt.hook('vite:serverCreated', (server: vite.ViteDevServer, env) => {
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
        warmupViteServer(server, [ctx.entry], env.isServer)
          .then(() => logger.info(`Vite ${env.isClient ? 'client' : 'server'} warmed up in ${Date.now() - start}ms`))
          .catch(logger.error)
      })
    }
  })

  await withLogs(() => buildClient(nuxt, ctx), 'Vite client built', nuxt.options.dev)
  await withLogs(() => buildServer(nuxt, ctx), 'Vite server built', nuxt.options.dev)
}

async function withLogs (fn: () => Promise<void>, message: string, enabled = true) {
  if (!enabled) { return fn() }

  const start = performance.now()
  await fn()
  const duration = performance.now() - start
  logger.success(`${message} in ${Math.round(duration)}ms`)
}
