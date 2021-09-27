import { Worker } from 'worker_threads'

import { IncomingMessage, ServerResponse } from 'http'
import { loading as loadingTemplate } from '@nuxt/design'
import chokidar, { FSWatcher } from 'chokidar'
import debounce from 'debounce'
import { stat } from 'fs-extra'
import { promisifyHandle, createApp, Middleware, useBase } from 'h3'
import { createProxy } from 'http-proxy'
import { listen, Listener, ListenOptions } from 'listhen'
import servePlaceholder from 'serve-placeholder'
import serveStatic from 'serve-static'
import { resolve } from 'pathe'
import type { Server } from 'connect'
import type { NitroContext } from '../context'
import { handleVfs } from './vfs'

export function createDevServer (nitroContext: NitroContext) {
  // Worker
  const workerEntry = resolve(nitroContext.output.dir, nitroContext.output.serverDir, 'index.mjs')
  let pendingWorker: Worker | null
  let activeWorker: Worker
  let workerAddress: string | null
  async function reload () {
    if (pendingWorker) {
      await pendingWorker.terminate()
      workerAddress = null
      pendingWorker = null
    }
    if (!(await stat(workerEntry)).isFile) {
      throw new Error('Entry not found: ' + workerEntry)
    }
    return new Promise((resolve, reject) => {
      const worker = pendingWorker = new Worker(workerEntry)
      worker.once('exit', (code) => {
        if (code) {
          reject(new Error('[worker] exited with code: ' + code))
        }
      })
      worker.on('error', (err) => {
        err.message = '[worker] ' + err.message
        reject(err)
      })
      worker.on('message', (event) => {
        if (event && event.port) {
          workerAddress = 'http://localhost:' + event.port
          activeWorker = worker
          pendingWorker = null
          resolve(workerAddress)
        }
      })
    })
  }

  // App
  const app = createApp()

  // _nuxt and static
  app.use(nitroContext._nuxt.publicPath, serveStatic(resolve(nitroContext._nuxt.buildDir, 'dist/client')))
  app.use(nitroContext._nuxt.routerBase, serveStatic(resolve(nitroContext._nuxt.publicDir)))

  // debugging endpoint to view vfs
  app.use('/_vfs', useBase('/_vfs', handleVfs(nitroContext)))

  // Dynamic Middlwware
  const legacyMiddleware = createDynamicMiddleware()
  const devMiddleware = createDynamicMiddleware()
  app.use(legacyMiddleware.middleware)
  app.use(devMiddleware.middleware)

  // serve placeholder 404 assets instead of hitting SSR
  app.use(nitroContext._nuxt.publicPath, servePlaceholder())

  // SSR Proxy
  const proxy = createProxy()
  const proxyHandle = promisifyHandle((req: IncomingMessage, res: ServerResponse) => proxy.web(req, res, { target: workerAddress }, (_err: unknown) => {
    // console.error('[proxy]', err)
  }))
  app.use((req, res) => {
    if (workerAddress) {
      // Workaround to pass legacy req.spa to proxy
      // @ts-ignore
      if (req.spa) {
        req.headers['x-nuxt-no-ssr'] = 'true'
      }
      return proxyHandle(req, res)
    } else {
      res.setHeader('Content-Type', 'text/html; charset=UTF-8')
      res.end(loadingTemplate({}))
    }
  })

  // Listen
  let listeners: Listener[] = []
  const _listen = async (port: ListenOptions['port'], opts?: Partial<ListenOptions>) => {
    const listener = await listen(app, { port, ...opts })
    listeners.push(listener)
    return listener
  }

  // Watch for dist and reload worker
  const pattern = '**/*.{js,json,cjs,mjs}'
  const events = ['add', 'change']
  let watcher: FSWatcher
  function watch () {
    if (watcher) { return }
    const dReload = debounce(() => reload().catch(console.warn), 200, true)
    watcher = chokidar.watch([
      resolve(nitroContext.output.serverDir, pattern),
      resolve(nitroContext._nuxt.buildDir, 'dist/server', pattern)
    ]).on('all', event => events.includes(event) && dReload())
  }

  // Close handler
  async function close () {
    if (watcher) {
      await watcher.close()
    }
    if (activeWorker) {
      await activeWorker.terminate()
    }
    if (pendingWorker) {
      await pendingWorker.terminate()
    }
    await Promise.all(listeners.map(l => l.close()))
    listeners = []
  }
  nitroContext._internal.hooks.hook('close', close)

  return {
    reload,
    listen: _listen,
    app,
    close,
    watch,
    setLegacyMiddleware: legacyMiddleware.set,
    setDevMiddleware: devMiddleware.set
  }
}

interface DynamicMiddleware {
  set: (input: Middleware) => void
  middleware: Middleware
}

function createDynamicMiddleware (): DynamicMiddleware {
  let middleware: Middleware
  return {
    set: (input) => {
      if (!Array.isArray(input)) {
        middleware = input
        return
      }
      const app: Server = require('connect')()
      for (const m of input) {
        app.use(m.path || m.route || '/', m.handler || m.handle!)
      }
      middleware = app
    },
    middleware: (req, res, next) =>
      middleware ? middleware(req, res, next) : next()
  }
}
