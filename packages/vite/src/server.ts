import { resolve, join, normalize } from 'pathe'
import * as vite from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import viteJsxPlugin from '@vitejs/plugin-vue-jsx'
import { logger, resolveModule } from '@nuxt/kit'
import fse from 'fs-extra'
import pDebounce from 'p-debounce'
import { withoutTrailingSlash } from 'ufo'
import { ViteBuildContext, ViteOptions } from './vite'
import { wpfs } from './utils/wpfs'
import { cacheDirPlugin } from './plugins/cache-dir'
import { prepareDevServerEntry } from './vite-node'
import { DynamicBasePlugin } from './plugins/dynamic-base'
import { isCSS, isDirectory, readDirRecursively } from './utils'
import { bundleRequest } from './dev-bundler'
import { writeManifest } from './manifest'

export async function buildServer (ctx: ViteBuildContext) {
  const _resolve = id => resolveModule(id, { paths: ctx.nuxt.options.modulesDir })
  const serverConfig: vite.InlineConfig = vite.mergeConfig(ctx.config, {
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
        // Alias vue
        'vue/server-renderer': _resolve('vue/server-renderer'),
        'vue/compiler-sfc': _resolve('vue/compiler-sfc'),
        '@vue/reactivity': _resolve(`@vue/reactivity/dist/reactivity.cjs${ctx.nuxt.options.dev ? '' : '.prod'}.js`),
        '@vue/shared': _resolve(`@vue/shared/dist/shared.cjs${ctx.nuxt.options.dev ? '' : '.prod'}.js`),
        'vue-router': _resolve(`vue-router/dist/vue-router.cjs${ctx.nuxt.options.dev ? '' : '.prod'}.js`),
        vue: _resolve(`vue/dist/vue.cjs${ctx.nuxt.options.dev ? '' : '.prod'}.js`)
      }
    },
    ssr: {
      noExternal: [
        ...ctx.nuxt.options.build.transpile,
        // TODO: Use externality for production (rollup) build
        /\/esm\/.*\.js$/,
        /\.(es|esm|esm-browser|esm-bundler).js$/,
        '/__vue-jsx',
        '#app',
        /nuxt3\/(dist|src|app)/,
        /@nuxt\/nitro\/(dist|src)/
      ]
    },
    build: {
      outDir: resolve(ctx.nuxt.options.buildDir, 'dist/server'),
      ssr: ctx.nuxt.options.ssr ?? true,
      rollupOptions: {
        output: {
          entryFileNames: 'server.mjs',
          preferConst: true,
          format: 'module'
        },
        external: ['#config'],
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
      DynamicBasePlugin.vite({ env: ctx.nuxt.options.dev ? 'dev' : 'server', devAppConfig: ctx.nuxt.options.app }),
      viteJsxPlugin()
    ]
  } as ViteOptions)

  await ctx.nuxt.callHook('vite:extendConfig', serverConfig, { isClient: false, isServer: true })

  ctx.nuxt.hook('nitro:generate', async () => {
    const clientDist = resolve(ctx.nuxt.options.buildDir, 'dist/client')

    // Remove public files that have been duplicated into buildAssetsDir
    // TODO: Add option to configure this behavior in vite
    const publicDir = join(ctx.nuxt.options.srcDir, ctx.nuxt.options.dir.public)
    let publicFiles: string[] = []
    if (await isDirectory(publicDir)) {
      publicFiles = readDirRecursively(publicDir).map(r => r.replace(publicDir, ''))
      for (const file of publicFiles) {
        try {
          fse.rmSync(join(clientDist, file))
        } catch {}
      }
    }

    // Copy doubly-nested /_nuxt/_nuxt files into buildAssetsDir
    // TODO: Workaround vite issue
    if (await isDirectory(clientDist)) {
      const nestedAssetsPath = withoutTrailingSlash(join(clientDist, ctx.nuxt.options.app.buildAssetsDir))

      if (await isDirectory(nestedAssetsPath)) {
        await fse.copy(nestedAssetsPath, clientDist, { recursive: true })
        await fse.remove(nestedAssetsPath)
      }
    }
  })

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
    const doBuild = pDebounce(pDebounce.promise(_doBuild), 100)

    // Initial build
    await _doBuild()

    // Watch
    viteServer.watcher.on('all', (_event, file) => {
      file = normalize(file) // Fix windows paths
      if (file.indexOf(ctx.nuxt.options.buildDir) === 0) { return }
      doBuild()
    })
    // ctx.nuxt.hook('builder:watch', () => doBuild())
    ctx.nuxt.hook('app:templatesGenerated', () => doBuild())
  }
}
