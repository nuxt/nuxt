import { IncomingMessage } from 'http'
import { ViteNodeServer } from 'vite-node/server'
import fse from 'fs-extra'
import { resolve } from 'pathe'
import { addServerMiddleware } from '@nuxt/kit'
import type { Connect, Plugin as VitePlugin } from 'vite'
import { distDir } from './dirs'
import type { ViteBuildContext } from './vite'

// TODO: Remove this in favor of registerViteNodeMiddleware
// after Nitropack or h3 fixed for adding middlewares after setup
export function viteNodePlugin (ctx: ViteBuildContext): VitePlugin {
  return {
    name: 'nuxt:vite-node-server',
    enforce: 'pre',
    configureServer (server) {
      server.middlewares.use('/__nuxt_vite_node__', createViteNodeMiddleware(ctx))
    }
  }
}

export function registerViteNodeMiddleware (ctx: ViteBuildContext) {
  addServerMiddleware({
    route: '/__nuxt_vite_node__/',
    handle: createViteNodeMiddleware(ctx)
  })
}

function createViteNodeMiddleware (ctx: ViteBuildContext): Connect.NextHandleFunction {
  let node: ViteNodeServer | undefined
  return async (req, res, next) => {
    if (!node && ctx.ssrServer) {
      node = new ViteNodeServer(ctx.ssrServer, {
        deps: {
          inline: [
            ...ctx.nuxt.options.build.transpile as string[]
          ]
        }
      })
    }
    if (!node) {
      return next()
    }

    const body = await getBodyJson(req) || {}
    const { id } = body
    if (!id) {
      res.statusCode = 400
      res.end()
    } else {
      res.write(JSON.stringify(await node.fetchModule(id)))
      res.end()
    }
  }
}

export async function prepareDevServerEntry (ctx: ViteBuildContext) {
  const entryPath = resolve(ctx.nuxt.options.appDir, 'entry.async')
  const raw = await fse.readFile(resolve(distDir, 'runtime/server.mjs'), 'utf-8')
  const host = ctx.nuxt.options.server.host || 'localhost'
  const port = ctx.nuxt.options.server.port || '3000'
  const protocol = ctx.nuxt.options.server.https ? 'https' : 'http'
  const code = raw
    .replace('__NUXT_SERVER_FETCH_URL__', `${protocol}://${host}:${port}/__nuxt_vite_node__/`)
    .replace('__NUXT_SERVER_ENTRY__', entryPath)
    .replace('__NUXT_SERVER_BASE__', ctx.ssrServer.config.base || '/_nuxt/')
  await fse.writeFile(
    resolve(ctx.nuxt.options.buildDir, 'dist/server/server.mjs'),
    code,
    'utf-8'
  )
}

function getBodyJson (req: IncomingMessage) {
  return new Promise<any>((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('error', reject)
    req.on('end', () => {
      try {
        resolve(JSON.parse(body) || {})
      } catch (e) {
        reject(e)
      }
    })
  })
}
