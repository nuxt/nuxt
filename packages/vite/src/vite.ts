import { existsSync } from 'node:fs'
import * as vite from 'vite'
import { dirname, join, normalize, resolve } from 'pathe'
import type { Nuxt, NuxtBuilder, ViteConfig } from '@nuxt/schema'
import { addVitePlugin, createIsIgnored, logger, resolvePath, useNitro } from '@nuxt/kit'
import replace from '@rollup/plugin-replace'
import type { RollupReplaceOptions } from '@rollup/plugin-replace'
import { sanitizeFilePath } from 'mlly'
import { withoutLeadingSlash } from 'ufo'
import { filename } from 'pathe/utils'
import { resolveTSConfig } from 'pkg-types'
import { resolveModulePath } from 'exsolve'

import { buildClient } from './client'
import { buildServer } from './server'
import { warmupViteServer } from './utils/warmup'
import { resolveCSSOptions } from './css'
import { logLevelMap } from './utils/logger'
import { ssrStylesPlugin } from './plugins/ssr-styles'
import { VitePublicDirsPlugin } from './plugins/public-dirs'
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

  const isIgnored = createIsIgnored(nuxt)
  const ctx: ViteBuildContext = {
    nuxt,
    entry,
    config: vite.mergeConfig(
      {
        logLevel: logLevelMap[nuxt.options.logLevel] ?? logLevelMap.info,
        resolve: {
          alias: {
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
                return relativeSourcePath.includes('node_modules') || relativeSourcePath.includes(ctx.nuxt.options.buildDir)
              },
              sanitizeFileName: sanitizeFilePath,
              // https://github.com/vitejs/vite/tree/main/packages/vite/src/node/build.ts#L464-L478
              assetFileNames: nuxt.options.dev
                ? undefined
                : chunk => withoutLeadingSlash(join(nuxt.options.app.buildAssetsDir, `${sanitizeFilePath(filename(chunk.names[0]!))}.[hash].[ext]`)),
            },
          },
          watch: {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore Rolldown-Vite specific
            ...(vite.rolldownVersion
              ? {
                  // TODO: Find equivalent for rolldown-vite here
                }
              : {
                  chokidar: { ...nuxt.options.watchers.chokidar, ignored: [isIgnored, /[\\/]node_modules[\\/]/] },
                }
            ),
            exclude: nuxt.options.ignore,
          },
        },
        plugins: [
          // add resolver for files in public assets directories
          VitePublicDirsPlugin.vite({
            dev: nuxt.options.dev,
            sourcemap: !!nuxt.options.sourcemap.server,
            baseURL: nuxt.options.app.baseURL,
          }),
          // @ts-expect-error https://github.com/vitejs/rolldown-vite/issues/117
          replace({ preventAssignment: true, ...globalThisReplacements }),
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
      ctx.nuxt.hook('vite:extendConfig', (config) => {
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
  if (!ctx.nuxt.options.test && (ctx.nuxt.options.typescript.typeCheck === true || (ctx.nuxt.options.typescript.typeCheck === 'build' && !ctx.nuxt.options.dev))) {
    const checker = await import('vite-plugin-checker').then(r => r.default)
    addVitePlugin(checker({
      vueTsc: {
        tsconfigPath: await resolveTSConfig(ctx.nuxt.options.rootDir),
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

    config.plugins!.push(replace(replaceOptions) as any)
  })

  if (!ctx.nuxt.options.dev) {
    const chunksWithInlinedCSS = new Set<string>()
    const clientCSSMap = {}

    nuxt.hook('vite:extendConfig', (config, { isServer }) => {
      config.plugins!.unshift(ssrStylesPlugin({
        srcDir: ctx.nuxt.options.srcDir,
        clientCSSMap,
        chunksWithInlinedCSS,
        shouldInline: ctx.nuxt.options.features.inlineStyles,
        components: ctx.nuxt.apps.default!.components || [],
        globalCSS: ctx.nuxt.options.css,
        mode: isServer ? 'server' : 'client',
        entry: ctx.entry,
      }))
    })

    // Remove CSS entries for files that will have inlined styles
    ctx.nuxt.hook('build:manifest', (manifest) => {
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
    ctx.nuxt.hook('app:templatesGenerated', async (_app, changedTemplates) => {
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

  await withLogs(() => buildClient(ctx), 'Vite client built', ctx.nuxt.options.dev)
  await withLogs(() => buildServer(ctx), 'Vite server built', ctx.nuxt.options.dev)
}

const globalThisReplacements = Object.fromEntries([';', '(', '{', '}', ' ', '\t', '\n'].map(d => [`${d}global.`, `${d}globalThis.`]))

async function withLogs (fn: () => Promise<void>, message: string, enabled = true) {
  if (!enabled) { return fn() }

  const start = performance.now()
  await fn()
  const duration = performance.now() - start
  logger.success(`${message} in ${Math.round(duration)}ms`)
}
