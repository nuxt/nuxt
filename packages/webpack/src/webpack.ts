import { promisify } from 'node:util'
import type { H3Event as H3V1Event } from 'h3'
import type { H3Event as H3V2Event } from 'h3-next'
import type webpackDevMiddleware from 'webpack-dev-middleware'
import type { IncomingMessage, MultiWatching, ServerResponse } from 'webpack-dev-middleware'
import type { Compiler, Configuration, Stats, Watching } from 'webpack'
import { defu } from 'defu'
import type { Nuxt, NuxtBuilder } from '@nuxt/schema'
import { resolve } from 'pathe'
import { joinURL } from 'ufo'
import { logger, setBuildOutput, useNitro, useNuxt } from '@nuxt/kit'
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import type { InputPluginOption } from 'rollup'

import { DynamicBasePlugin } from './plugins/dynamic-base.ts'
import { ChunkErrorPlugin } from './plugins/chunk.ts'
import { SSRStylesPlugin } from './plugins/ssr-styles.ts'
import { createMFS } from './utils/mfs.ts'
import { isSameOriginRequest, resolveAllowedHosts } from './utils/same-origin.ts'
import { client } from './configs/client.ts'
import { server } from './configs/server.ts'
import { applyPresets, createWebpackConfigContext } from './utils/config.ts'

import { builder, webpack } from './builder.ts'

/** Generate the configuration of the client and server builds, calling the `config` and `configResolved` hooks. */
export async function resolveConfigs (nuxt: Nuxt): Promise<Configuration[]> {
  const webpackConfigs = await Promise.all([client, ...(nuxt.options.ssr ? [server] : [])].map(async (preset) => {
    const ctx = createWebpackConfigContext(nuxt)
    ctx.userConfig = defu(nuxt.options.webpack[`$${preset.name as 'client' | 'server'}`], ctx.userConfig)
    await applyPresets(ctx, [preset])
    return ctx.config
  }))

  /** Remove Nitro rollup plugin for handling dynamic imports from webpack chunks */
  if (!nuxt.options.dev) {
    const nitro = useNitro()
    nitro.hooks.hook('rollup:before', (_nitro: unknown, config: { plugins?: unknown }) => {
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
    const serverEntryFile = resolve(nuxt.options.buildDir, 'dist/server/server.mjs')
    setBuildOutput('serverEntry', () => `export { default } from ${JSON.stringify(serverEntryFile)}`)
  }

  const ssrStylesPlugin = nuxt.options.ssr && !nuxt.options.dev ? new SSRStylesPlugin(nuxt) : null

  for (const config of webpackConfigs) {
    config.plugins!.push(DynamicBasePlugin.webpack())
    if (config.name === 'client' && nuxt.options.experimental.emitRouteChunkError && builder !== 'rspack') {
      config.plugins!.push(new ChunkErrorPlugin())
    }
    if (ssrStylesPlugin) {
      config.plugins!.push(ssrStylesPlugin)
    }
  }

  await nuxt.callHook(`${builder}:configResolved`, webpackConfigs)

  return webpackConfigs
}

export const bundle: NuxtBuilder['bundle'] = async (nuxt) => {
  const webpackConfigs = await resolveConfigs(nuxt)

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

// h3 sentinel signalling that the response has already been written to the
// raw node `res`; returning `undefined` instead would make h3 treat the
// request as unhandled and fall through to the SSR catch-all handler.
export const kHandled: unique symbol = /* @__PURE__ */ Symbol.for('h3.handled')

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

  nuxt.hook('close', () => promisify(devMiddleware.close.bind(devMiddleware))())

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
    const { req, res } = 'runtime' in event ? event.runtime!.node! : event.node
    if (!isSameOriginRequest(req, resolveAllowedHosts(nuxt.options))) {
      res!.statusCode = 403
      res!.end('Forbidden')
      return kHandled
    }
    const body = await devHandler(event)
    if (body !== undefined) {
      return body
    }
    await new Promise<void>((resolve, reject) => hotMiddleware(req as IncomingMessage, res as ServerResponse, err => err ? reject(err) : resolve()))
  }), { cors: () => true })

  return devMiddleware
}

// TODO: implement upstream in `webpack-dev-middleware`
function wdmToH3Handler (devMiddleware: webpackDevMiddleware.API<IncomingMessage, ServerResponse>) {
  return defineEventHandler(async (event) => {
    const { req, res } = 'runtime' in event ? event.runtime!.node! : event.node
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

export async function compile (compiler: Compiler): Promise<unknown> {
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
      await Promise.all(compilersWatching.map(watching => watching && promisify(watching.close.bind(watching))()))
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
    // eslint-disable-next-line no-restricted-syntax -- raw compiler output; the diagnostic below carries the errors as `cause`
    logger.error(formatted || '(no formatted errors emitted; see compilation errors below)')
    for (const err of compilationErrors) {
      // eslint-disable-next-line no-restricted-syntax -- raw compiler output; the diagnostic below carries the errors as `cause`
      logger.error(err)
    }
    throw bundlerDiagnostics.NUXT_B7014({ name: compiler.options.name!, cause: compilationErrors })
  }
}

type GenericHandler = (event: H3V1Event | H3V2Event) => unknown | Promise<unknown>

export function defineEventHandler (handler: GenericHandler): GenericHandler {
  return Object.assign(handler, { __is_handler__: true })
}
