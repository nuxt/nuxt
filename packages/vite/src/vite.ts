import { existsSync } from 'node:fs'
import * as vite from 'vite'
import { basename, dirname, join, normalize, resolve } from 'pathe'
import type { Nuxt, NuxtBuilder, ViteConfig } from '@nuxt/schema'
import { addVitePlugin, createIsIgnored, getLayerDirectories, logger, resolvePath, useNitro } from '@nuxt/kit'
import replace from '@rollup/plugin-replace'
import type { RollupReplaceOptions } from '@rollup/plugin-replace'
import { sanitizeFilePath } from 'mlly'
import { withTrailingSlash, withoutLeadingSlash } from 'ufo'
import { filename } from 'pathe/utils'
import { readTSConfig, resolveTSConfig } from 'pkg-types'
import { resolveModulePath } from 'exsolve'

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
    for (const dirs of getLayerDirectories(nuxt)) {
      if (dirs.app !== nuxt.options.srcDir && !dirs.app.startsWith(delimitedRootDir)) {
        layerDirs.push(dirs.app)
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
    const tsconfigPath = await resolveTSConfig(nuxt.options.rootDir)
    const supportsProjects = await readTSConfig(tsconfigPath).then(r => !!(r.references?.length))
    const checker = await import('vite-plugin-checker').then(r => r.default)
    addVitePlugin(checker({
      vueTsc: {
        tsconfigPath,
        buildMode: supportsProjects,
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
      for (const id of chunksWithInlinedCSS) {
        const chunk = manifest[id]
        if (!chunk) {
          continue
        }
        if (chunk.isEntry) {
          // @ts-expect-error internal key
          chunk._globalCSS = true
        } else {
          chunk.css &&= []
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
