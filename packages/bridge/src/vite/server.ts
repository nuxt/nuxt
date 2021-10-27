import { resolve } from 'pathe'
import * as vite from 'vite'
import { createVuePlugin } from 'vite-plugin-vue2'
import consola from 'consola'
import fse from 'fs-extra'
import pDebounce from 'p-debounce'
import { bundleRequest } from '../../../vite/src/dev-bundler'
import { ViteBuildContext, ViteOptions } from './types'
import { wpfs } from './utils/wpfs'
import { jsxPlugin } from './plugins/jsx'
import { generateDevSSRManifest } from './manifest'
import { isCSS } from './utils'

export async function buildServer (ctx: ViteBuildContext) {
  // Workaround to disable HMR
  const _env = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  const vuePlugin = createVuePlugin(ctx.config.vue)
  process.env.NODE_ENV = _env

  const alias = {}
  for (const p of ctx.builder.plugins) {
    alias[p.name] = p.mode === 'client'
      ? `defaultexport:${resolve(ctx.nuxt.options.buildDir, 'empty.js')}`
      : `defaultexport:${p.src}`
  }

  const serverConfig: vite.InlineConfig = vite.mergeConfig(ctx.config, {
    define: {
      'process.server': true,
      'process.client': false,
      'process.static': false,
      'typeof window': '"undefined"',
      'typeof document': '"undefined"',
      'typeof navigator': '"undefined"',
      'typeof location': '"undefined"',
      'typeof XMLHttpRequest': '"undefined"'
    },
    cacheDir: resolve(ctx.nuxt.options.rootDir, 'node_modules/.cache/vite/server'),
    resolve: {
      alias
    },
    ssr: {
      external: [
        'axios'
      ],
      noExternal: [
        /\.(es|esm|esm-browser|esm-bundler).js$/,
        ...ctx.nuxt.options.build.transpile.filter(i => typeof i === 'string')
      ]
    },
    build: {
      outDir: resolve(ctx.nuxt.options.buildDir, 'dist/server'),
      assetsDir: ctx.nuxt.options.app.assetsPath.replace(/^\/|\/$/, ''),
      ssr: true,
      ssrManifest: true,
      rollupOptions: {
        input: resolve(ctx.nuxt.options.buildDir, 'server.js'),
        output: {
          format: 'esm',
          entryFileNames: 'server.mjs',
          chunkFileNames: 'chunks/[name].mjs'
        },
        onwarn (warning, rollupWarn) {
          if (!['UNUSED_EXTERNAL_IMPORT'].includes(warning.code)) {
            rollupWarn(warning)
          }
        }
      }
    },
    plugins: [
      jsxPlugin(),
      vuePlugin
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

  // Start development server
  const viteServer = await vite.createServer(serverConfig)
  ctx.nuxt.hook('close', () => viteServer.close())

  // Initialize plugins
  await viteServer.pluginContainer.buildStart({})

  // Generate manifest files
  await fse.writeFile(resolve(ctx.nuxt.options.buildDir, 'dist/server/ssr-manifest.json'), JSON.stringify({}, null, 2), 'utf-8')
  await generateDevSSRManifest(ctx)

  // Build and watch
  const _doBuild = async () => {
    const start = Date.now()
    const { code, ids } = await bundleRequest({ viteServer }, '/.nuxt/server.js')
    // Have CSS in the manifest to prevent FOUC on dev SSR
    await generateDevSSRManifest(ctx, ids.filter(isCSS).map(i => '../' + i.slice(1)))
    await fse.writeFile(resolve(ctx.nuxt.options.buildDir, 'dist/server/server.mjs'), code, 'utf-8')
    const time = (Date.now() - start)
    consola.info(`Server built in ${time}ms`)
    await onBuild()
  }
  const doBuild = pDebounce(_doBuild, 300)

  // Initial build
  await _doBuild()

  // Watch
  viteServer.watcher.on('all', (_event, file) => {
    if (file.indexOf(ctx.nuxt.options.buildDir) === 0) { return }
    doBuild()
  })
}
