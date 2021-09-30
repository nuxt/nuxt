import { resolve } from 'pathe'
import * as vite from 'vite'
import vuePlugin from '@vitejs/plugin-vue'
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
    resolve: {
      alias: {
        '#build/plugins': resolve(ctx.nuxt.options.buildDir, 'plugins/server')
      }
    },
    ssr: {
      external: [
        'axios'
      ],
      noExternal: [
        ...ctx.nuxt.options.build.transpile.filter(i => typeof i === 'string'),
        '#app'
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

  if (!ctx.nuxt.options.ssr) {
    await onBuild()
    return
  }

  let lastBuild = 0
  const build = async () => {
    let start = Date.now()
    // debounce
    if (start - lastBuild < 300) {
      await sleep(300 - (start - lastBuild) + 1)
      start = Date.now()
      if (start - lastBuild < 300) {
        return
      }
    }
    lastBuild = start
    await vite.build(serverConfig)
    await onBuild()
    consola.info(`Server built in ${Date.now() - start}ms`)
  }

  await build()

  ctx.nuxt.hook('builder:watch', () => build())
  ctx.nuxt.hook('app:templatesGenerated', () => build())
}

function sleep (ms:number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
