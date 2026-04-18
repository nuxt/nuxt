import { existsSync } from 'node:fs'
import * as vite from 'vite'
import { basename, dirname, join, normalize, relative, resolve } from 'pathe'
import type { Nuxt, NuxtBuilder, ViteConfig } from '@nuxt/schema'
import { createIsIgnored, getLayerDirectories, logger, resolvePath, useNitro } from '@nuxt/kit'
import { sanitizeFilePath } from 'mlly'
import { withTrailingSlash, withoutLeadingSlash } from 'ufo'
import { filename } from 'pathe/utils'
import { resolveModulePath } from 'exsolve'

import vuePlugin from '@vitejs/plugin-vue'
import { onigiriChunkPlugin, onigiriCompilerPlugin, onigiriManifestPlugin } from 'vue-onigiri'
import { buildClient } from './client'
import { buildServer } from './server'
import { warmupViteServer } from './utils/warmup'
import { resolveCSSOptions } from './css'
import { logLevelMap } from './utils/logger'
import { SSRStylesPlugin } from './plugins/ssr-styles'
import { PublicDirsPlugin } from './plugins/public-dirs'
import { ReplacePlugin } from './plugins/replace'
import { LayerDepOptimizePlugin } from './plugins/layer-dep-optimize'
import { distDir } from './dirs'
import type { Plugin } from 'rollup'
import { EnvironmentsPlugin } from './plugins/environments'

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
          // add resolver for files in public assets directories
          PublicDirsPlugin({
            dev: nuxt.options.dev,
            baseURL: nuxt.options.app.baseURL,
          }),
          ReplacePlugin(),
          LayerDepOptimizePlugin(nuxt),
          SSRStylesPlugin(nuxt),
          EnvironmentsPlugin(nuxt),
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

  // vue-onigiri integration. Both client and server builds get the same
  // plugin set — onigiri's chunk plugin emits source paths in `__chunk`,
  // and `virtual:onigiri/manifest` (via `import.meta.glob`) resolves those
  // paths to the correct module in each environment.
  //
  // The `virtual:vsc:<abs-path>` prefix is used by Nuxt's island templates
  // (`components/templates.ts`) to disambiguate server variants of a
  // component. We strip the prefix and hand the raw path to Vite /
  // plugin-vue, which compiles it as a normal SFC in the active env.
  const vscPlugin: Plugin = {
    name: 'nuxt:virtual-vsc',
    resolveId: {
      order: 'pre',
      handler (id) {
        if (id.startsWith('virtual:vsc:')) {
          return id.slice('virtual:vsc:'.length)
        }
        if (id.startsWith('/@id/virtual:vsc:')) {
          return id.slice('/@id/virtual:vsc:'.length)
        }
      },
    },
  }

  const onigiri: Plugin[] = [
    vscPlugin,
    onigiriCompilerPlugin(),
    onigiriChunkPlugin(),
    onigiriManifestPlugin(),
  ]

  // Register onigiri plugins into Vite's client + server configs. The
  // compiler plugin declares `enforce: 'post'` so it runs AFTER
  // @vitejs/plugin-vue's transform (seeing its compiled output) but
  // before Vite's `vite:import-analysis` — the latter needs to see the
  // `virtual:onigiri:*` imports we inject so it can rewrite them to
  // browser-fetchable `/@id/` URLs.
  nuxt.hook('vite:extendConfig', (viteInlineConfig) => {
    viteInlineConfig.plugins ||= []
    viteInlineConfig.plugins.push(...onigiri)
  })

  // Nitro (SSR runtime) also imports from `virtual:vsc:*` (Nuxt island
  // templates) and `virtual:onigiri/manifest` (vue-onigiri runtime loader,
  // inlined via nuxt.config's `nitro.externals.inline`). Mirror both
  // resolvers into the rollup build.
  useNitro().hooks.hook('rollup:before', (_, rollupConfig) => {
    (rollupConfig.plugins! as Plugin[]).push({
      name: 'nuxt:virtual-vsc',
      resolveId: {
        order: 'pre',
        handler (id) {
          if (id.startsWith('virtual:vsc:')) {
            return id.slice('virtual:vsc:'.length)
          }
        },
      },
    });
    (rollupConfig.plugins! as Plugin[]).push(onigiriManifestPlugin())
  })

  // In build mode we explicitly override any vite options that vite is relying on
  // to detect whether to inject production or development code (such as HMR code)
  if (!nuxt.options.dev) {
    ctx.config.server!.watch = undefined
    ctx.config.build!.watch = undefined
  }

  await nuxt.callHook('vite:extend', ctx)

  nuxt.hook('vite:serverCreated', (server: vite.ViteDevServer, env) => {
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
  // `buildClient` / `buildServer` expect a factory that takes plugin-vue's
  // options and returns the plugin list to prepend. Plain `@vitejs/plugin-vue`
  // is enough — onigiri plugins are added separately through
  // `vite:extendConfig` above.
  const vueFactory = (opts: any) => [vuePlugin(opts)]
  await withLogs(() => buildClient(nuxt, ctx, vueFactory), 'Vite client built', nuxt.options.dev)
  await withLogs(() => buildServer(nuxt, ctx, vueFactory), 'Vite server built', nuxt.options.dev)
}

async function withLogs (fn: () => Promise<void>, message: string, enabled = true) {
  if (!enabled) { return fn() }

  const start = performance.now()
  await fn()
  const duration = performance.now() - start
  logger.success(`${message} in ${Math.round(duration)}ms`)
}
