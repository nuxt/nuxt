import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Nuxt } from '@nuxt/schema'
import type { RsbuildDevServer, RsbuildInstance } from '@rsbuild/core'
import { logger } from '@nuxt/kit'
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import type { H3Event as H3V1Event } from 'h3'
import type { H3Event as H3V2Event } from 'h3-next'
import { joinURL } from 'ufo'

import { isSameOriginRequest } from '../../webpack/src/utils/same-origin.ts'

/**
 * Path of the HMR WebSocket. It is kept under the build assets directory, so the
 * upgrade requests are not forwarded to Nitro.
 */
export function getHMRPath (nuxt: Nuxt) {
  return joinURL(nuxt.options.app.baseURL, nuxt.options.app.buildAssetsDir, 'rsbuild-hmr')
}

export async function setupDevServer (nuxt: Nuxt, rsbuild: RsbuildInstance) {
  logger.debug('Creating Rsbuild dev server...')

  const devServer = await rsbuild.createDevServer({ getPortSilently: true })
  nuxt.hook('close', () => devServer.close())

  // Attach the HMR WebSocket to the Nuxt dev server, so it shares the app's port and TLS certificate
  const listener = nuxt._devServerListener
  if (listener) {
    devServer.connectWebSocket({ server: listener })
    await devServer.afterListen()
  } else {
    bundlerDiagnostics.NUXT_B7017()
  }

  const assetsPath = joinURL(nuxt.options.app.baseURL, nuxt.options.app.buildAssetsDir, '/')
  // `builds/` under the build assets directory is served by Nitro (app manifest)
  const nitroBuildsPath = joinURL(assetsPath, 'builds/')
  await nuxt.callHook('server:devHandler', defineEventHandler(async (event) => {
    const { req, res } = 'runtime' in event ? event.runtime!.node! : event.node
    if (!req.url?.startsWith(assetsPath) || req.url.startsWith(nitroBuildsPath)) {
      return
    }

    if (!isSameOriginRequest(req)) {
      res!.statusCode = 403
      res!.end('Forbidden')
    } else if (!await handleRequest(devServer, req as IncomingMessage, res as ServerResponse)) {
      // do not render the app for build assets that do not exist
      res!.statusCode = 404
      res!.end()
    }

    // the response has already been sent
    if ('runtime' in event) {
      return kHandled
    }
  }), { cors: () => true })

  // wait for the initial compilation of all environments
  await Promise.all(Object.values(devServer.environments).map(environment => environment.getStats()))
}

/** Signals to h3 v2 that the response has already been sent. */
const kHandled = Symbol.for('h3.handled')

/** Resolves to `true` when the request was handled by Rsbuild, or `false` when it was passed through. */
function handleRequest (devServer: RsbuildDevServer, req: IncomingMessage, res: ServerResponse) {
  return new Promise<boolean>((resolve, reject) => {
    res.once('close', () => resolve(true))
    res.once('finish', () => resolve(true))
    devServer.middlewares(req, res, (error?: unknown) => error ? reject(error) : resolve(false))
  })
}

type GenericHandler = (event: H3V1Event | H3V2Event) => unknown | Promise<unknown>

function defineEventHandler (handler: GenericHandler): GenericHandler {
  return Object.assign(handler, { __is_handler__: true })
}
