import { resolve, normalize } from 'pathe'
import * as vite from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import viteJsxPlugin from '@vitejs/plugin-vue-jsx'
import { logger, resolveModule, isIgnored } from '@nuxt/kit'
import fse from 'fs-extra'
import { debounce } from 'perfect-debounce'
import { joinURL, withoutLeadingSlash, withTrailingSlash } from 'ufo'
import { ViteBuildContext, ViteOptions } from './vite'
import { wpfs } from './utils/wpfs'
import { cacheDirPlugin } from './plugins/cache-dir'
import { prepareDevServerEntry } from './vite-node'
import { isCSS } from './utils'
import { bundleRequest } from './dev-bundler'
import { writeManifest } from './manifest'

export async function buildServer (ctx: ViteBuildContext) {
  const _resolve = id => resolveModule(id, { paths: ctx.nuxt.options.modulesDir })
  const serverConfig: vite.InlineConfig = vite.mergeConfig(ctx.config, {
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
          return { runtime: `globalThis.__publicAssetsURL(${JSON.stringify(filename)})` }
        }
        if (type === 'asset') {
          const relativeFilename = filename.replace(withTrailingSlash(withoutLeadingSlash(ctx.nuxt.options.app.buildAssetsDir)), '')
          return { runtime: `globalThis.__buildAssetsURL(${JSON.stringify(relativeFilename)})` }
        }
      }
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
        ...ctx.nuxt.options.build.transpile,
        // TODO: Use externality for production (rollup) build
        /\/esm\/.*\.js$/,
        /\.(es|esm|esm-browser|esm-bundler).js$/,
        '/__vue-jsx',
        '#app',
        /(nuxt|nuxt3)\/(dist|src|app)/,
        /@nuxt\/nitro\/(dist|src)/
      ]
    },
    build: {
      outDir: resolve(ctx.nuxt.options.buildDir, 'dist/server'),
      ssr: ctx.nuxt.options.ssr ?? true,
      rollupOptions: {
        external: ['#internal/nitro', ...ctx.nuxt.options.experimental.externalVue ? ['vue', 'vue-router'] : []],
        output: {
          entryFileNames: 'server.mjs',
          preferConst: true,
          // TODO: https://github.com/vitejs/vite/pull/8641
          inlineDynamicImports: false,
          format: 'module'
        },
        onwarn (warning, rollupWarn) {
          if (!['UNUSED_EXTERNAL_IMPORT'].includes(warning.code)) {
            rollupWarn(warning)
          }
        }
      }
    },
    server: {
      // https://github.com/vitest-dev/vitest/issues/229#issuecomment-1002685027
      preTransformRequests: false
    },
    plugins: [
      cacheDirPlugin(ctx.nuxt.options.rootDir, 'server'),
      vuePlugin(ctx.config.vue),
      viteJsxPlugin()
    ]
  } as ViteOptions)

  // Add type-checking
  if (ctx.nuxt.options.typescript.typeCheck === true || (ctx.nuxt.options.typescript.typeCheck === 'build' && !ctx.nuxt.options.dev)) {
    const checker = await import('vite-plugin-checker').then(r => r.default)
    serverConfig.plugins.push(checker({ vueTsc: true }))
  }

  await ctx.nuxt.callHook('vite:extendConfig', serverConfig, { isClient: false, isServer: true })

  const onBuild = () => ctx.nuxt.callHook('build:resources', wpfs)

  // Production build
  if (!ctx.nuxt.options.dev) {
    const start = Date.now()
    logger.info('Building server...')
    await vite.build(serverConfig)
    await onBuild()
    logger.success(`Server built in ${Date.now() - start}ms`)
    return
  }

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

  if (ctx.nuxt.options.experimental.viteNode) {
    logger.info('Vite server using experimental `vite-node`...')
    await prepareDevServerEntry(ctx)
  } else {
    // Build and watch
    const _doBuild = async () => {
      const start = Date.now()
      const { code, ids } = await bundleRequest({ viteServer }, resolve(ctx.nuxt.options.appDir, 'entry'))
      await fse.writeFile(resolve(ctx.nuxt.options.buildDir, 'dist/server/server.mjs'), code, 'utf-8')
      // Have CSS in the manifest to prevent FOUC on dev SSR
      await writeManifest(ctx, ids.filter(isCSS).map(i => i.slice(1)))
      const time = (Date.now() - start)
      logger.success(`Vite server built in ${time}ms`)
      await onBuild()
    }
    const doBuild = debounce(_doBuild)

    // Initial build
    await _doBuild()

    // Watch
    viteServer.watcher.on('all', (_event, file) => {
      file = normalize(file) // Fix windows paths
      if (file.indexOf(ctx.nuxt.options.buildDir) === 0 || isIgnored(file)) { return }
      doBuild()
    })
    // ctx.nuxt.hook('builder:watch', () => doBuild())
    ctx.nuxt.hook('app:templatesGenerated', () => doBuild())
  }
}
