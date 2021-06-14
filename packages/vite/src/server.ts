import { resolve } from 'path'
import * as vite from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
import { mkdirp, writeFile } from 'fs-extra'
import debounce from 'debounce'
import consola from 'consola'
import { ViteBuildContext, ViteOptions } from './vite'
import { wpfs } from './utils/wpfs'
import { cacheDirPlugin } from './plugins/cache-dir'

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
    ssr: {
      external: [
        'axios'
      ],
      noExternal: [
        '@nuxt/app'
      ]
    },
    build: {
      outDir: 'dist/server',
      ssr: true,
      rollupOptions: {
        input: resolve(ctx.nuxt.options.buildDir, 'entry.mjs'),
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

  const serverDist = resolve(ctx.nuxt.options.buildDir, 'dist/server')
  await mkdirp(serverDist)

  await writeFile(resolve(serverDist, 'server.js'), 'module.exports = require("./entry")', 'utf8')
  await writeFile(resolve(serverDist, 'client.manifest.json'), 'false', 'utf8')

  const onBuild = () => ctx.nuxt.callHook('build:resources', wpfs)

  if (!ctx.nuxt.options.ssr) {
    await onBuild()
    return
  }

  const build = debounce(async () => {
    const start = Date.now()
    await vite.build(serverConfig)
    await onBuild()
    consola.info(`Server built in ${Date.now() - start}ms`)
  }, 300)

  await build()

  ctx.nuxt.hook('builder:watch', () => build())
  ctx.nuxt.hook('app:templatesGenerated', () => build())
}
