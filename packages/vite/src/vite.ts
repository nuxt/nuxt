import { existsSync } from 'node:fs'
import * as vite from 'vite'
import { basename, dirname, join, resolve } from 'pathe'
import type { Nuxt, ViteConfig } from '@nuxt/schema'
import { addVitePlugin, isIgnored, logger, resolvePath } from '@nuxt/kit'
import replace from '@rollup/plugin-replace'
import { sanitizeFilePath } from 'mlly'
import { withoutLeadingSlash } from 'ufo'
import { filename } from 'pathe/utils'
import { resolveTSConfig } from 'pkg-types'
import { consola } from 'consola'
import { buildClient } from './client'
import { buildServer } from './server'
import virtual from './plugins/virtual'
import { warmupViteServer } from './utils/warmup'
import { resolveCSSOptions } from './css'
import { composableKeysPlugin } from './plugins/composable-keys'
import { logLevelMap } from './utils/logger'
import { ssrStylesPlugin } from './plugins/ssr-styles'

export interface ViteBuildContext {
  nuxt: Nuxt
  config: ViteConfig
  entry: string
  clientServer?: vite.ViteDevServer
  ssrServer?: vite.ViteDevServer
}

export async function bundle (nuxt: Nuxt) {
  // https://github.com/vitejs/vite/blob/8fe69524d25d45290179175ba9b9956cbce87a91/packages/vite/src/node/constants.ts#L38
  const viteConfigPrefix = resolve(nuxt.options.rootDir, 'vite.config')
  const viteConfigFile = await resolvePath(viteConfigPrefix).catch(() => null)
  if (viteConfigFile && viteConfigFile !== viteConfigPrefix) {
    consola.warn(`Using \`${basename(viteConfigFile)}\` is not supported together with Nuxt. Use \`options.vite\` instead. You can read more in \`https://nuxt.com/docs/api/configuration/nuxt-config#vite\`.`)
  }

  const useAsyncEntry = nuxt.options.experimental.asyncEntry ||
    (nuxt.options.vite.devBundler === 'vite-node' && nuxt.options.dev)
  const entry = await resolvePath(resolve(nuxt.options.appDir, useAsyncEntry ? 'entry.async' : 'entry'))

  let allowDirs = [
    nuxt.options.appDir,
    nuxt.options.workspaceDir,
    ...nuxt.options._layers.map(l => l.config.rootDir),
    ...Object.values(nuxt.apps).flatMap(app => [
      ...app.components.map(c => dirname(c.filePath)),
      ...app.plugins.map(p => dirname(p.src)),
      ...app.middleware.map(m => dirname(m.path)),
      ...Object.values(app.layouts || {}).map(l => dirname(l.file)),
      dirname(nuxt.apps.default.rootComponent!),
      dirname(nuxt.apps.default.errorComponent!)
    ])
  ].filter(d => d && existsSync(d))

  for (const dir of allowDirs) {
    allowDirs = allowDirs.filter(d => !d.startsWith(dir) || d === dir)
  }

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
            // We need this resolution to be present before the following entry, but it
            // will be filled in client/server configs
            '#build/plugins': '',
            '#build': nuxt.options.buildDir,
            'web-streams-polyfill/ponyfill/es2018': 'unenv/runtime/mock/empty',
            // Cannot destructure property 'AbortController' of ..
            'abort-controller': 'unenv/runtime/mock/empty'
          }
        },
        optimizeDeps: {
          include: ['vue'],
          exclude: ['nuxt/app']
        },
        css: resolveCSSOptions(nuxt),
        define: { __NUXT_VERSION__: JSON.stringify(nuxt._version) },
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
                : chunk => withoutLeadingSlash(join(nuxt.options.app.buildAssetsDir, `${sanitizeFilePath(filename(chunk.name!))}.[hash].[ext]`))
            }
          },
          watch: {
            exclude: nuxt.options.ignore
          }
        },
        plugins: [
          composableKeysPlugin.vite({
            sourcemap: nuxt.options.sourcemap.server || nuxt.options.sourcemap.client,
            rootDir: nuxt.options.rootDir,
            composables: nuxt.options.optimization.keyedComposables
          }),
          replace({
            ...Object.fromEntries([';', '(', '{', '}', ' ', '\t', '\n'].map(d => [`${d}global.`, `${d}globalThis.`])),
            preventAssignment: true
          }),
          virtual(nuxt.vfs)
        ],
        vue: {
          reactivityTransform: nuxt.options.experimental.reactivityTransform
        },
        server: {
          watch: { ignored: isIgnored },
          fs: {
            allow: [...new Set(allowDirs)]
          }
        }
      } satisfies ViteConfig,
      nuxt.options.vite
    )
  }

  // In build mode we explicitly override any vite options that vite is relying on
  // to detect whether to inject production or development code (such as HMR code)
  if (!nuxt.options.dev) {
    ctx.config.server!.watch = undefined
    ctx.config.build!.watch = undefined
  }

  // Add type-checking
  if (ctx.nuxt.options.typescript.typeCheck === true || (ctx.nuxt.options.typescript.typeCheck === 'build' && !ctx.nuxt.options.dev)) {
    const checker = await import('vite-plugin-checker').then(r => r.default)
    addVitePlugin(checker({
      vueTsc: {
        tsconfigPath: await resolveTSConfig(ctx.nuxt.options.rootDir)
      }
    }), { server: nuxt.options.ssr })
  }

  await nuxt.callHook('vite:extend', ctx)

  if (!ctx.nuxt.options.dev) {
    const chunksWithInlinedCSS = new Set<string>()
    const clientCSSMap = {}

    nuxt.hook('vite:extendConfig', (config, { isServer }) => {
      config.plugins!.push(ssrStylesPlugin({
        srcDir: ctx.nuxt.options.srcDir,
        clientCSSMap,
        chunksWithInlinedCSS,
        shouldInline: ctx.nuxt.options.experimental.inlineSSRStyles,
        components: ctx.nuxt.apps.default.components,
        globalCSS: ctx.nuxt.options.css,
        mode: isServer ? 'server' : 'client',
        entry: ctx.entry
      }))
    })

    // Remove CSS entries for files that will have inlined styles
    ctx.nuxt.hook('build:manifest', (manifest) => {
      for (const key in manifest) {
        const entry = manifest[key]
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
    ctx.nuxt.hook('app:templatesGenerated', () => {
      for (const [id, mod] of server.moduleGraph.idToModuleMap) {
        if (id.startsWith('virtual:')) {
          server.moduleGraph.invalidateModule(mod)
        }
      }
    })

    if (
      nuxt.options.vite.warmupEntry !== false &&
      // https://github.com/nuxt/nuxt/issues/14898
      !(env.isServer && ctx.nuxt.options.vite.devBundler !== 'legacy')
    ) {
      const start = Date.now()
      warmupViteServer(server, [join('/@fs/', ctx.entry)], env.isServer)
        .then(() => logger.info(`Vite ${env.isClient ? 'client' : 'server'} warmed up in ${Date.now() - start}ms`))
        .catch(logger.error)
    }
  })

  await buildClient(ctx)
  await buildServer(ctx)
}
