import { resolve } from 'path'
import type { Nuxt } from '@nuxt/kit'
import { mkdirp, writeFile } from 'fs-extra'
import vue from '@vitejs/plugin-vue'
import consola from 'consola'
import * as vite from 'vite'

interface ViteBuildContext {
  nuxt: Nuxt
  config: vite.InlineConfig
}

export async function bundle (nuxt: Nuxt) {
  const ctx: ViteBuildContext = {
    nuxt,
    config: {
      root: nuxt.options.buildDir,
      mode: nuxt.options.dev ? 'development' : 'production',
      logLevel: 'warn',
      resolve: {
        alias: {
          'nuxt/app': nuxt.options.appDir,
          'nuxt/build': nuxt.options.buildDir,
          '~': nuxt.options.srcDir,
          '@': nuxt.options.srcDir
        }
      },
      clearScreen: false,
      plugins: [
        vue({})
      ],
      build: {
        emptyOutDir: false
      }
    }
  }

  await mkdirp(nuxt.options.buildDir)
  await mkdirp(resolve(nuxt.options.buildDir, '.vite/temp'))

  const callBuild = async (fn, name) => {
    try {
      const start = Date.now()
      await fn(ctx)
      const time = (Date.now() - start) / 1000
      consola.success(`${name} compiled successfully in ${time}s`)
    } catch (err) {
      consola.error(`${name} compiled with errors:`, err)
    }
  }

  if (nuxt.options.dev) {
    await Promise.all([
      callBuild(buildClient, 'Client'),
      callBuild(buildServer, 'Server')
    ])
  } else {
    await callBuild(buildClient, 'Client')
    await callBuild(buildServer, 'Server')
  }
}

async function buildClient (ctx: ViteBuildContext) {
  const clientConfig: vite.InlineConfig = vite.mergeConfig(ctx.config, {
    define: {
      'process.server': false,
      'process.client': true
    },
    build: {
      outDir: 'dist/client',
      assetsDir: '.',
      rollupOptions: {
        input: resolve(ctx.nuxt.options.buildDir, './entry.client.js')
      }
    },
    server: {
      middlewareMode: true
    }
  } as vite.InlineConfig)

  if (ctx.nuxt.options.dev) {
    const viteServer = await vite.createServer(clientConfig)
    await ctx.nuxt.callHook('server:devMiddleware', (req, res, next) => {
      // Workaround: vite devmiddleware modifies req.url
      const originalURL = req.url
      viteServer.middlewares.handle(req, res, (err) => {
        req.url = originalURL
        next(err)
      })
    })
  } else {
    await vite.build(clientConfig)
  }
}

async function buildServer (ctx: ViteBuildContext) {
  const serverConfig: vite.InlineConfig = vite.mergeConfig(ctx.config, {
    define: {
      'process.server': true,
      'process.client': false,
      window: undefined
    },
    build: {
      outDir: 'dist/server',
      ssr: true,
      rollupOptions: {
        input: resolve(ctx.nuxt.options.buildDir, './entry.server.js'),
        onwarn (warning, rollupWarn) {
          if (!['UNUSED_EXTERNAL_IMPORT'].includes(warning.code)) {
            rollupWarn(warning)
          }
        }
      }
    }
  } as vite.InlineConfig)

  const serverDist = resolve(ctx.nuxt.options.buildDir, 'dist/server')
  await mkdirp(serverDist)
  await writeFile(resolve(serverDist, 'client.manifest.json'), 'false')
  await writeFile(resolve(serverDist, 'server.js'), 'const entry = require("./entry.server.js"); module.exports = entry.default || entry;')

  await vite.build(serverConfig)

  if (ctx.nuxt.options.dev) {
    ctx.nuxt.hook('builder:watch', () => {
      vite.build(serverConfig).catch(consola.error)
    })
  }
}
