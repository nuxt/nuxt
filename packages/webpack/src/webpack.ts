import pify from 'pify'
import type { H3Event as H3V1Event } from 'h3'
import type { H3Event as H3V2Event } from 'h3-next'
import type webpackDevMiddleware from 'webpack-dev-middleware'
import type { IncomingMessage, MultiWatching, ServerResponse } from 'webpack-dev-middleware'
import type { Compiler, Configuration, MultiCompiler, Stats, Watching } from 'webpack'
import { defu } from 'defu'
import type { Nuxt, NuxtBuilder } from '@nuxt/schema'
import { pathToFileURL } from 'node:url'
import { resolve } from 'pathe'
import { joinURL } from 'ufo'
import { bundlerDiagnostics, logger, setBuildOutput, useNitro, useNuxt } from '@nuxt/kit'
import type { InputPluginOption } from 'rollup'

import { DynamicBasePlugin } from './plugins/dynamic-base.ts'
import { ChunkErrorPlugin } from './plugins/chunk.ts'
import { SSRStylesPlugin } from './plugins/ssr-styles.ts'
import { createMFS } from './utils/mfs.ts'
import { isSameOriginRequest } from './utils/same-origin.ts'
import { client, server } from './configs/index.ts'
import { applyPresets, createWebpackConfigContext } from './utils/config.ts'

import { builder, createRsbuild, webpack } from '#builder'

// TODO: Support plugins
// const plugins: string[] = []

export const bundle: NuxtBuilder['bundle'] = async (nuxt) => {
  const webpackConfigs = await Promise.all([client, ...(nuxt.options.ssr ? [server] : [])].map(async (preset) => {
    const ctx = createWebpackConfigContext(nuxt)
    ctx.userConfig = defu(nuxt.options.webpack[`$${preset.name as 'client' | 'server'}`], ctx.userConfig)
    await applyPresets(ctx, preset)
    return ctx.config
  }))

  /** Remove Nitro rollup plugin for handling dynamic imports from webpack chunks */
  if (!nuxt.options.dev) {
    const nitro = useNitro()
    nitro.hooks.hook('rollup:before', (_nitro, config) => {
      const plugins = config.plugins as InputPluginOption[]

      const existingPlugin = plugins.findIndex(i => i && 'name' in i && i.name === 'dynamic-require')
      if (existingPlugin >= 0) {
        plugins.splice(existingPlugin, 1)
      }
    })
  }

  await nuxt.callHook(`${builder}:config`, webpackConfigs)

  // In dev the SSR entry is served from the in-memory bundle via the builder compile hook.
  if (nuxt.options.ssr && !nuxt.options.dev) {
    const serverEntryFile = pathToFileURL(resolve(nuxt.options.buildDir, 'dist/server/server.mjs')).href
    setBuildOutput('serverEntry', () => `export { default } from ${JSON.stringify(serverEntryFile)}`)
  }

  const ssrStylesPlugin = nuxt.options.ssr && !nuxt.options.dev ? new SSRStylesPlugin(nuxt) : null

  for (const config of webpackConfigs) {
    config.plugins!.push(DynamicBasePlugin.webpack())
    // Emit chunk errors if the user has opted in to `experimental.emitRouteChunkError`
    if (config.name === 'client' && nuxt.options.experimental.emitRouteChunkError && nuxt.options.builder !== '@nuxt/rspack-builder') {
      config.plugins!.push(new ChunkErrorPlugin())
    }
    if (ssrStylesPlugin) {
      config.plugins!.push(ssrStylesPlugin)
    }
  }

  await nuxt.callHook(`${builder}:configResolved`, webpackConfigs)

  // Rsbuild owns the dev server (middleware mode) and, in production, the
  // compiler lifecycle. Everything else falls back to plain webpack.
  if (builder === 'rspack' && createRsbuild) {
    const rsbuild = await createRsbuildInstance(webpackConfigs, nuxt)

    if (nuxt.options.dev) {
      await startRsbuildDevServer(rsbuild, nuxt)
      return
    }

    const compilers = await getRsbuildCompilers(rsbuild)
    nuxt.hook('close', async () => {
      for (const compiler of compilers) {
        await new Promise(resolve => compiler.close(resolve))
      }
    })
    for (const c of compilers) {
      await compile(c)
    }
    return
  }

  // Initialize shared MFS for dev
  const mfs = nuxt.options.dev ? createMFS() : null
  const compilers = webpackConfigs.map(config => webpack(config))

  // In dev, write files in memory FS
  if (nuxt.options.dev) {
    for (const compiler of compilers) {
      compiler.outputFileSystem = mfs! as unknown as Compiler['outputFileSystem']
    }
  }

  nuxt.hook('close', async () => {
    for (const compiler of compilers) {
      await new Promise(resolve => compiler.close(resolve))
    }
  })

  // Start Builds
  if (nuxt.options.dev) {
    await Promise.all(compilers.map(c => compile(c)))
    return
  }

  for (const c of compilers) {
    await compile(c)
  }
}

function createRsbuildInstance (configs: Configuration[], nuxt: Nuxt) {
  // One rsbuild environment per Nuxt bundle (client → web, server → node)
  const environments: Record<string, unknown> = {}
  for (const config of configs) {
    const isServer = config.name === 'server'
    // Rsbuild's dev server only injects its HMR client into `web` compilers.
    if (nuxt.options.dev && !isServer) {
      config.target ??= 'web'
    }
    environments[config.name!] = {
      output: {
        target: isServer ? 'node' : 'web',
        // The dev server serves assets from `<distPath>/<url after publicPath>`,
        // so point it at the same directory the compiler writes to.
        distPath: { root: config.output!.path as string },
      },
      tools: {
        // Nuxt generates the full rspack configuration itself, so the
        // rsbuild-generated config is replaced rather than merged into
        rspack: () => config,
      },
    }
  }

  return createRsbuild!({
    callerName: 'nuxt',
    cwd: nuxt.options.rootDir,
    config: {
      root: nuxt.options.rootDir,
      mode: nuxt.options.dev ? 'development' : 'production',
      logLevel: 'silent',
      environments,
      ...nuxt.options.dev
        ? {
            server: { middlewareMode: true },
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

async function getRsbuildCompilers (rsbuild: Awaited<ReturnType<NonNullable<typeof createRsbuild>>>): Promise<Compiler[]> {
  // Returns a MultiCompiler when more than one environment is configured
  const compiler = await rsbuild.createCompiler()
  return ('compilers' in compiler ? compiler.compilers : [compiler]) as Compiler[]
}

async function startRsbuildDevServer (rsbuild: Awaited<ReturnType<NonNullable<typeof createRsbuild>>>, nuxt: Nuxt) {
  // Nitro reads the server bundle from the compiler's in-memory output, so the
  // build must not be considered ready until every compiler has emitted once.
  const firstCompiles: Array<Promise<void>> = []

  rsbuild.onAfterCreateCompiler(({ compiler }: { compiler: Compiler | MultiCompiler }) => {
    const compilers = ('compilers' in compiler ? compiler.compilers : [compiler]) as Compiler[]
    for (const c of compilers) {
      const name = c.options.name!
      nuxt.callHook(`${builder}:compile`, { name, compiler: c })

      let settled = false
      firstCompiles.push(new Promise<void>((resolve, reject) => {
        c.hooks.done.tap('load-resources', (stats) => {
          nuxt.callHook(`${builder}:compiled`, { name, compiler: c, stats: stats as Stats })
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

  await nuxt.callHook('server:devHandler', rsbuildToH3Handler(devServer.middlewares), { cors: () => true })

  await Promise.all(firstCompiles)
}

function rsbuildToH3Handler (middlewares: (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void) {
  return defineEventHandler(async (event) => {
    const { req, res } = 'runtime' in event ? event.runtime!.node! : event.node
    if (!isSameOriginRequest(req)) {
      res!.statusCode = 403
      res!.end('Forbidden')
      return
    }
    await new Promise<void>((resolve) => {
      let settled = false
      const done = () => {
        if (!settled) {
          settled = true
          resolve()
        }
      }
      // Middlewares that serve a response end it without calling `next`, so also
      // settle when the response finishes; `next` means Nuxt should handle it.
      res!.on('finish', done)
      res!.on('close', done)
      middlewares(req as IncomingMessage, res as ServerResponse, () => done())
    })
  })
}

async function createDevMiddleware (compiler: Compiler) {
  const nuxt = useNuxt()

  logger.debug('Creating webpack middleware...')

  const { default: webpackDevMiddleware } = await import('webpack-dev-middleware')
  const { default: webpackHotMiddleware } = await import('webpack-hot-middleware')

  // Create webpack dev middleware
  const devMiddleware = webpackDevMiddleware(compiler, {
    publicPath: joinURL(nuxt.options.app.baseURL, nuxt.options.app.buildAssetsDir),
    outputFileSystem: compiler.outputFileSystem as any,
    stats: 'none',
    ...nuxt.options.webpack.devMiddleware,
  })

  // @ts-expect-error need better types for `pify`
  nuxt.hook('close', () => pify(devMiddleware.close.bind(devMiddleware))())

  const { client: _client, ...hotMiddlewareOptions } = nuxt.options.webpack.hotMiddleware || {}
  const hotMiddleware = webpackHotMiddleware(compiler, {
    log: false,
    heartbeat: 10000,
    path: joinURL(nuxt.options.app.baseURL, '__webpack_hmr', compiler.options.name!),
    ...hotMiddlewareOptions,
  })

  // Register devMiddleware on server
  const devHandler = wdmToH3Handler(devMiddleware)
  await nuxt.callHook('server:devHandler', defineEventHandler(async (event) => {
    const body = await devHandler(event)
    if (body !== undefined) {
      return body
    }
    const { req, res } = 'runtime' in event ? event.runtime!.node! : event.node
    await new Promise<void>((resolve, reject) => hotMiddleware(req as IncomingMessage, res as ServerResponse, err => err ? reject(err) : resolve()))
  }), { cors: () => true })

  return devMiddleware
}

// TODO: implement upstream in `webpack-dev-middleware`
function wdmToH3Handler (devMiddleware: webpackDevMiddleware.API<IncomingMessage, ServerResponse>) {
  return defineEventHandler(async (event) => {
    const { req, res } = 'runtime' in event ? event.runtime!.node! : event.node
    if (!isSameOriginRequest(req)) {
      res!.statusCode = 403
      res!.end('Forbidden')
      return
    }

    const body = await new Promise((resolve, reject) => {
      // @ts-expect-error handle injected methods
      res.stream = (stream) => {
        resolve(stream)
      }
      // @ts-expect-error handle injected methods
      res.send = (data) => {
        resolve(data)
      }
      // @ts-expect-error handle injected methods
      res.finish = (data) => {
        resolve(data)
      }
      devMiddleware(req as IncomingMessage, res as ServerResponse, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve(undefined)
        }
      })
    })
    return body
  })
}

async function compile (compiler: Compiler) {
  const nuxt = useNuxt()

  await nuxt.callHook(`${builder}:compile`, { name: compiler.options.name!, compiler })

  // Load renderer resources after build
  compiler.hooks.done.tap('load-resources', async (stats) => {
    await nuxt.callHook(`${builder}:compiled`, { name: compiler.options.name!, compiler, stats })
  })

  // --- Dev Build ---
  if (nuxt.options.dev) {
    const compilersWatching: Array<Watching | MultiWatching> = []

    nuxt.hook('close', async () => {
      await Promise.all(compilersWatching.map(watching => watching && pify(watching.close.bind(watching))()))
    })

    // Client build
    if (compiler.options.name === 'client') {
      return new Promise((resolve, reject) => {
        compiler.hooks.done.tap('nuxt-dev', () => { resolve(null) })
        compiler.hooks.failed.tap('nuxt-errorlog', (err) => { reject(err) })
        // Start watch
        createDevMiddleware(compiler).then((devMiddleware) => {
          if (devMiddleware.context.watching) {
            compilersWatching.push(devMiddleware.context.watching)
          }
        })
      })
    }

    // Server, build and watch for changes
    return new Promise((resolve, reject) => {
      const watching = compiler.watch(nuxt.options.watchers.webpack, (err) => {
        if (err) { return reject(err) }
        resolve(null)
      })

      compilersWatching.push(watching)
    })
  }

  // --- Production Build ---
  const stats = await new Promise<Stats>((resolve, reject) => compiler.run((err, stats) => err ? reject(err) : resolve(stats!)))

  if (stats.hasErrors()) {
    const formatted = stats.toString({ errors: true, warnings: false, colors: false, errorDetails: true })
    const compilationErrors = stats.compilation?.errors ?? []
    logger.error(formatted || '(no formatted errors emitted; see compilation errors below)')
    for (const err of compilationErrors) {
      logger.error(err)
    }
    throw bundlerDiagnostics.NUXT_B7014({ name: compiler.options.name!, cause: compilationErrors })
  }
}

type GenericHandler = (event: H3V1Event | H3V2Event) => unknown | Promise<unknown>

function defineEventHandler (handler: GenericHandler): GenericHandler {
  return Object.assign(handler, { __is_handler__: true })
}

declare module 'srvx' {
  interface ServerRequestContext {
    webpack?: {
      devMiddleware?: webpackDevMiddleware.Context<IncomingMessage, ServerResponse>
    }
  }
}
