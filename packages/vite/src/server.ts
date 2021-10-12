import { resolve } from 'pathe'
import * as vite from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import fse from 'fs-extra'
import pDebounce from 'p-debounce'
import consola from 'consola'
import { ViteBuildContext, ViteOptions } from './vite'
import { wpfs } from './utils/wpfs'
import { cacheDirPlugin } from './plugins/cache-dir'
import { bundleRequest } from './dev-bundler'

export async function buildServer (ctx: ViteBuildContext) {
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
        'vue/server-renderer': 'vue/server-renderer',
        'vue/compiler-sfc': 'vue/compiler-sfc',
        '@vue/reactivity': `@vue/reactivity/dist/reactivity.cjs${ctx.nuxt.options.dev ? '' : '.prod'}.js`,
        '@vue/shared': `@vue/shared/dist/shared.cjs${ctx.nuxt.options.dev ? '' : '.prod'}.js`,
        'vue-router': `vue-router/dist/vue-router.cjs${ctx.nuxt.options.dev ? '' : '.prod'}.js`,
        vue: `vue/dist/vue.cjs${ctx.nuxt.options.dev ? '' : '.prod'}.js`
      }
    },
    ssr: {
      external: [
        'axios'
      ],
      noExternal: [
        ...ctx.nuxt.options.build.transpile.filter(i => typeof i === 'string'),
        '.vue',
        'plugin-vue:',
        '#app',
        'nuxt3',
        '@nuxt/nitro'
      ]
    },
    build: {
      outDir: resolve(ctx.nuxt.options.buildDir, 'dist/server'),
      ssr: true,
      rollupOptions: {
        output: {
          entryFileNames: 'server.mjs',
          preferConst: true,
          format: 'module'
        },
        onwarn (warning, rollupWarn) {
          if (!['UNUSED_EXTERNAL_IMPORT'].includes(warning.code)) {
            rollupWarn(warning)
          }
        }
      }
    },
    plugins: [
      cacheDirPlugin(ctx.nuxt.options.rootDir, 'server'),
      vuePlugin()
    ]
  } as ViteOptions)

  await ctx.nuxt.callHook('vite:extendConfig', serverConfig, { isClient: false, isServer: true })

  const onBuild = () => ctx.nuxt.callHook('build:resources', wpfs)

  // Production build
  if (!ctx.nuxt.options.dev) {
    const start = Date.now()
    consola.info('Building server...')
    await vite.build(serverConfig)
    await onBuild()
    consola.success(`Server built in ${Date.now() - start}ms`)
    return
  }

  if (!ctx.nuxt.options.ssr) {
    await onBuild()
    return
  }

  // Start development server
  const viteServer = await vite.createServer(serverConfig)

  // Close server on exit
  ctx.nuxt.hook('close', () => viteServer.close())

  // Initialize plugins
  await viteServer.pluginContainer.buildStart({})

  // Build and watch
  const _doBuild = async () => {
    const start = Date.now()
    const { code } = await bundleRequest({ viteServer }, resolve(ctx.nuxt.options.appDir, 'entry'))
    await fse.writeFile(resolve(ctx.nuxt.options.buildDir, 'dist/server/server.mjs'), code, 'utf-8')
    const time = (Date.now() - start)
    consola.success(`Vite server built in ${time}ms`)
    await onBuild()
  }
  const doBuild = pDebounce(_doBuild, 100)

  // Initial build
  await _doBuild()

  // Watch
  viteServer.watcher.on('all', (_event, file) => {
    if (file.indexOf(ctx.nuxt.options.buildDir) === 0) { return }
    doBuild()
  })
  // ctx.nuxt.hook('builder:watch', () => doBuild())
  ctx.nuxt.hook('app:templatesGenerated', () => doBuild())
}
