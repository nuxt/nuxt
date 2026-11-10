import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Nuxt } from '@nuxt/schema'
import type { RsbuildConfig, RsbuildInstance } from '@rsbuild/core'
import { createRsbuild } from '@rsbuild/core'
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import { resolve } from 'pathe'
import { joinURL } from 'ufo'
import type { Compiler, Configuration, MultiCompiler, Stats } from 'webpack'

import { compile, defineEventHandler, kHandled, resolveConfigs } from '../../webpack/src/webpack.ts'
import { isSameOriginRequest, resolveAllowedHosts } from '../../webpack/src/utils/same-origin.ts'

/**
 * Bundle with the Rspack configurations generated for the webpack builder, with Rsbuild
 * owning the dev server (in middleware mode) and the compiler lifecycle.
 */
export async function bundle (nuxt: Nuxt) {
  const configs = await resolveConfigs(nuxt)
  const rsbuild = await createRsbuildInstance(configs, nuxt)

  if (nuxt.options.dev) {
    await startRsbuildDevServer(rsbuild, nuxt)
    return
  }

  const compiler = await rsbuild.createCompiler()
  const compilers = toCompilers(compiler as unknown as Compiler | MultiCompiler)
  nuxt.hook('close', async () => {
    for (const compiler of compilers) {
      await new Promise(resolve => compiler.close(resolve))
    }
  })
  for (const c of compilers) {
    await compile(c)
  }
}

function toCompilers (compiler: Compiler | MultiCompiler): Compiler[] {
  return 'compilers' in compiler ? compiler.compilers : [compiler]
}

function createRsbuildInstance (configs: Configuration[], nuxt: Nuxt) {
  // One rsbuild environment per Nuxt bundle (client → web, server → node)
  const environments: NonNullable<RsbuildConfig['environments']> = {}
  for (const config of configs) {
    const isServer = config.name === 'server'
    // Rsbuild's dev server only injects its HMR client into `web` compilers.
    if (nuxt.options.dev && !isServer) {
      config.target ??= 'web'
    }
    const distPath = isServer && nuxt.options.dev
      ? resolve(nuxt.options.buildDir, 'dist/.rsbuild-server')
      : config.output!.path as string
    environments[config.name!] = {
      output: {
        target: isServer ? 'node' : 'web',
        distPath: { root: distPath },
      },
      tools: {
        // Nuxt generates the full rspack configuration itself, so the
        // rsbuild-generated config is replaced rather than merged into
        rspack: () => config as never,
      },
    }
  }

  return createRsbuild({
    callerName: 'nuxt',
    cwd: nuxt.options.rootDir,
    config: {
      root: nuxt.options.rootDir,
      mode: nuxt.options.dev ? 'development' : 'production',
      logLevel: 'silent',
      environments,
      ...nuxt.options.dev
        ? {
            server: { middlewareMode: true, allowedHosts: resolveAllowedHosts(nuxt.options) },
            dev: {
              // keep the HMR socket under the build-assets dir so
              // the upgrade won't be forwarded to nitro
              client: {
                path: joinURL(nuxt.options.app.baseURL, nuxt.options.app.buildAssetsDir, 'rsbuild-hmr'),
              },
            },
          }
        : {},
    },
  })
}

async function startRsbuildDevServer (rsbuild: RsbuildInstance, nuxt: Nuxt) {
  // Nitro reads the server bundle from the compiler's in-memory output, so the
  // build must not be considered ready until every compiler has emitted once.
  const firstCompiles: Array<Promise<void>> = []

  rsbuild.onAfterCreateCompiler(({ compiler }) => {
    for (const c of toCompilers(compiler as unknown as Compiler | MultiCompiler)) {
      const name = c.options.name!
      nuxt.callHook('rspack:compile', { name, compiler: c })

      let settled = false
      firstCompiles.push(new Promise<void>((resolve, reject) => {
        c.hooks.done.tap('load-resources', (stats) => {
          nuxt.callHook('rspack:compiled', { name, compiler: c, stats: stats as Stats })
          if (!settled) {
            settled = true
            resolve()
          }
        })
        c.hooks.failed.tap('nuxt-errorlog', (err) => {
          if (!settled) {
            settled = true
            reject(err)
          }
        })
      }))
    }
  })

  const devServer = await rsbuild.createDevServer()

  nuxt.hook('close', () => devServer.close())

  // Attach the HMR websocket to the nuxt dev server, so it shares the
  // app's port and TLS certificate rather than needing a second server.
  const listener = nuxt._devServerListener
  if (listener) {
    devServer.connectWebSocket({ server: listener })
    await devServer.afterListen()
  } else {
    bundlerDiagnostics.NUXT_B7017()
  }

  const buildAssetsPrefix = joinURL(nuxt.options.app.baseURL, nuxt.options.app.buildAssetsDir)
  // `builds/` under the assets dir is a Nitro-served virtual route (app manifest), not a bundler asset.
  const nitroBuildsPrefix = joinURL(buildAssetsPrefix, 'builds')
  await nuxt.callHook('server:devHandler', rsbuildToH3Handler(nuxt, devServer.middlewares, buildAssetsPrefix, nitroBuildsPrefix), { cors: () => true })

  await Promise.all(firstCompiles)
}

function rsbuildToH3Handler (nuxt: Nuxt, middlewares: (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void, buildAssetsPrefix: string, nitroBuildsPrefix: string) {
  return defineEventHandler((event) => {
    const { req, res } = 'runtime' in event ? event.runtime!.node! : event.node
    if (!isSameOriginRequest(req, resolveAllowedHosts(nuxt.options))) {
      res!.statusCode = 403
      res!.end('Forbidden')
      return kHandled
    }
    return new Promise<typeof kHandled | undefined>((resolve) => {
      let settled = false
      const done = (result: typeof kHandled | undefined) => {
        if (!settled) {
          settled = true
          resolve(result)
        }
      }
      // Middlewares that serve a response end it without calling `next`, so also
      // settle when the response finishes; `next` means Nuxt should handle it.
      res!.on('finish', () => done(kHandled))
      res!.on('close', () => done(kHandled))
      middlewares(req as IncomingMessage, res as ServerResponse, () => {
        const url = req!.url
        if (url && url.startsWith(buildAssetsPrefix) && !url.startsWith(nitroBuildsPrefix)) {
          res!.statusCode = 404
          res!.end()
          done(kHandled)
        } else {
          done(undefined)
        }
      })
    })
  })
}
