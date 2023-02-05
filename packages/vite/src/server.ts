import { resolve } from 'pathe'
import * as vite from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import viteJsxPlugin from '@vitejs/plugin-vue-jsx'
import { logger, resolveModule, resolvePath } from '@nuxt/kit'
import { joinURL, withoutLeadingSlash, withTrailingSlash } from 'ufo'
import type { ViteBuildContext, ViteOptions } from './vite'
import { cacheDirPlugin } from './plugins/cache-dir'
import { initViteNodeServer } from './vite-node'
import { ssrStylesPlugin } from './plugins/ssr-styles'
import { writeManifest } from './manifest'
import { transpile } from './utils/transpile'

export async function buildServer (ctx: ViteBuildContext) {
  const _resolve = (id: string) => resolveModule(id, { paths: ctx.nuxt.options.modulesDir })
  const helper = ctx.nuxt.options.nitro.imports !== false ? '' : 'globalThis.'
  const entry = ctx.nuxt.options.ssr ? ctx.entry : await resolvePath(resolve(ctx.nuxt.options.appDir, 'entry-spa'))
  const serverConfig: vite.InlineConfig = vite.mergeConfig(ctx.config, {
    entry,
    base: ctx.nuxt.options.dev
      ? joinURL(ctx.nuxt.options.app.baseURL.replace(/^\.\//, '/') || '/', ctx.nuxt.options.app.buildAssetsDir)
      : undefined,
    experimental: {
      renderBuiltUrl: (filename, { type, hostType }) => {
        if (hostType !== 'js') {
          // In CSS we only use relative paths until we craft a clever runtime CSS hack
          return { relative: true }
        }
        if (type === 'public') {
          return { runtime: `${helper}__publicAssetsURL(${JSON.stringify(filename)})` }
        }
        if (type === 'asset') {
          const relativeFilename = filename.replace(withTrailingSlash(withoutLeadingSlash(ctx.nuxt.options.app.buildAssetsDir)), '')
          return { runtime: `${helper}__buildAssetsURL(${JSON.stringify(relativeFilename)})` }
        }
      }
    },
    css: {
      devSourcemap: ctx.nuxt.options.sourcemap.server
    },
    define: {
      'process.server': true,
      'process.client': false,
      'typeof window': '"undefined"',
      'typeof document': '"undefined"',
      'typeof navigator': '"undefined"',
      'typeof location': '"undefined"',
      'typeof XMLHttpRequest': '"undefined"'
    },
    optimizeDeps: {
      entries: ctx.nuxt.options.ssr ? [ctx.entry] : []
    },
    resolve: {
      alias: {
        '#build/plugins': resolve(ctx.nuxt.options.buildDir, 'plugins/server'),
        ...ctx.nuxt.options.experimental.externalVue || ctx.nuxt.options.dev
          ? {}
          : {
              '@vue/reactivity': _resolve(`@vue/reactivity/dist/reactivity.cjs${ctx.nuxt.options.dev ? '' : '.prod'}.js`),
              '@vue/shared': _resolve(`@vue/shared/dist/shared.cjs${ctx.nuxt.options.dev ? '' : '.prod'}.js`),
              'vue-router': _resolve(`vue-router/dist/vue-router.cjs${ctx.nuxt.options.dev ? '' : '.prod'}.js`),
              'vue/server-renderer': _resolve('vue/server-renderer'),
              'vue/compiler-sfc': _resolve('vue/compiler-sfc'),
              vue: _resolve(`vue/dist/vue.cjs${ctx.nuxt.options.dev ? '' : '.prod'}.js`)
            }
      }
    },
    ssr: {
      external: ctx.nuxt.options.experimental.externalVue
        ? ['#internal/nitro', '#internal/nitro/utils', 'vue', 'vue-router']
        : ['#internal/nitro', '#internal/nitro/utils'],
      noExternal: [
        ...transpile({ isServer: true, isDev: ctx.nuxt.options.dev }),
        // TODO: Use externality for production (rollup) build
        /\/esm\/.*\.js$/,
        /\.(es|esm|esm-browser|esm-bundler).js$/,
        '/__vue-jsx',
        '#app',
        /^nuxt(\/|$)/,
        /(nuxt|nuxt3)\/(dist|src|app)/
      ]
    },
    build: {
      sourcemap: ctx.nuxt.options.sourcemap.server ? ctx.config.build?.sourcemap ?? true : false,
      outDir: resolve(ctx.nuxt.options.buildDir, 'dist/server'),
      ssr: true,
      rollupOptions: {
        input: entry,
        external: ['#internal/nitro', ...ctx.nuxt.options.experimental.externalVue ? ['vue', 'vue-router'] : []],
        output: {
          entryFileNames: 'server.mjs',
          format: 'module',
          generatedCode: {
            constBindings: true
          }
        },
        onwarn (warning, rollupWarn) {
          if (warning.code && ['UNUSED_EXTERNAL_IMPORT'].includes(warning.code)) {
            return
          }
          rollupWarn(warning)
        }
      }
    },
    server: {
      // https://github.com/vitest-dev/vitest/issues/229#issuecomment-1002685027
      preTransformRequests: false,
      hmr: false
    },
    plugins: [
      cacheDirPlugin(ctx.nuxt.options.rootDir, 'server'),
      vuePlugin(ctx.config.vue),
      viteJsxPlugin()
    ]
  } as ViteOptions)

  if (ctx.nuxt.options.experimental.inlineSSRStyles) {
    const chunksWithInlinedCSS = new Set<string>()
    serverConfig.plugins!.push(ssrStylesPlugin({
      srcDir: ctx.nuxt.options.srcDir,
      chunksWithInlinedCSS,
      shouldInline: typeof ctx.nuxt.options.experimental.inlineSSRStyles === 'function'
        ? ctx.nuxt.options.experimental.inlineSSRStyles
        : undefined
    }))

    // Remove CSS entries for files that will have inlined styles
    ctx.nuxt.hook('build:manifest', (manifest) => {
      for (const key in manifest) {
        const entry = manifest[key]
        const shouldRemoveCSS = chunksWithInlinedCSS.has(key)
        if (shouldRemoveCSS) {
          entry.css = []
        }
      }
    })
  }

  await ctx.nuxt.callHook('vite:extendConfig', serverConfig, { isClient: false, isServer: true })

  const onBuild = () => ctx.nuxt.callHook('vite:compiled')

  // Production build
  if (!ctx.nuxt.options.dev) {
    const start = Date.now()
    logger.info('Building server...')
    logger.restoreAll()
    await vite.build(serverConfig)
    logger.wrapAll()
    // Write production client manifest
    await writeManifest(ctx)
    await onBuild()
    logger.success(`Server built in ${Date.now() - start}ms`)
    return
  }

  // Write dev client manifest
  await writeManifest(ctx)

  if (!ctx.nuxt.options.ssr) {
    await onBuild()
    return
  }

  // Start development server
  const viteServer = await vite.createServer(serverConfig)
  ctx.ssrServer = viteServer

  await ctx.nuxt.callHook('vite:serverCreated', viteServer, { isClient: false, isServer: true })

  // Close server on exit
  ctx.nuxt.hook('close', () => viteServer.close())

  // Initialize plugins
  await viteServer.pluginContainer.buildStart({})

  if (ctx.config.devBundler !== 'legacy') {
    await initViteNodeServer(ctx)
  } else {
    logger.info('Vite server using legacy server bundler...')
    await import('./dev-bundler').then(r => r.initViteDevBundler(ctx, onBuild))
  }
}
