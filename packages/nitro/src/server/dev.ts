import { Worker } from 'worker_threads'

import { IncomingMessage, ServerResponse } from 'http'
import { existsSync, promises as fsp } from 'fs'
import { loading as loadingTemplate } from '@nuxt/design'
import chokidar, { FSWatcher } from 'chokidar'
import debounce from 'p-debounce'
import { promisifyHandle, createApp, Middleware, useBase } from 'h3'
import httpProxy from 'http-proxy'
import { listen, Listener, ListenOptions } from 'listhen'
import servePlaceholder from 'serve-placeholder'
import serveStatic from 'serve-static'
import { resolve } from 'pathe'
import connect from 'connect'
import type { NitroContext } from '../context'
import { handleVfs } from './vfs'

export interface NitroWorker {
  worker: Worker,
  address: string
}

function initWorker (filename): Promise<NitroWorker> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(filename)
    worker.once('exit', (code) => {
      if (code) {
        reject(new Error('[worker] exited with code: ' + code))
      }
    })
    worker.on('error', (err) => {
      console.error('[worker]', err)
      err.message = '[worker] ' + err.message
      reject(err)
    })
    worker.on('message', (event) => {
      if (event && event.address) {
        resolve({
          worker,
          address: event.address
        } as NitroWorker)
      }
    })
  })
}

async function killWorker (worker?: NitroWorker) {
  if (!worker) {
    return
  }
  await worker.worker?.terminate()
  worker.worker = null
  if (worker.address && existsSync(worker.address)) {
    await fsp.rm(worker.address).catch(() => {})
  }
}

export function createDevServer (nitroContext: NitroContext) {
  // Worker
  const workerEntry = resolve(nitroContext.output.dir, nitroContext.output.serverDir, 'index.mjs')

  let currentWorker: NitroWorker

  async function reload () {
    // Create a new worker
    const newWorker = await initWorker(workerEntry)

    // Kill old worker in background
    killWorker(currentWorker).catch(err => console.error(err))

    // Replace new worker as current
    currentWorker = newWorker
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
  const proxy = httpProxy.createProxy()
  const proxyHandle = promisifyHandle((req: IncomingMessage, res: ServerResponse) => {
    proxy.web(req, res, { target: currentWorker.address }, (error: unknown) => {
      console.error('[proxy]', error)
    })
  })
  app.use((req, res) => {
    if (currentWorker?.address) {
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
    const dReload = debounce(() => reload().catch(console.warn), 200, { before: true })
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
    await killWorker(currentWorker)
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
      const app = connect()
      for (const m of input) {
        app.use(m.path || m.route || '/', m.handler || m.handle!)
      }
      middleware = app
    },
    middleware: (req, res, next) =>
      middleware ? middleware(req, res, next) : next()
  }
}
