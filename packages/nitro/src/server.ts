import { Worker } from 'worker_threads'
import connect from 'connect'
import { resolve } from 'upath'
import debounce from 'debounce'
import chokidar from 'chokidar'
import { listen, Listener } from 'listhen'
import serveStatic from 'serve-static'
import { createProxy } from 'http-proxy'
import { stat } from 'fs-extra'
import type { SigmaContext } from './context'

export function createDevServer (sigmaContext: SigmaContext) {
  // Worker
  const workerEntry = resolve(sigmaContext.output.dir, sigmaContext.output.serverDir, 'index.js')
  let pendingWorker: Worker
  let activeWorker: Worker
  let workerAddress: string
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
  const app = connect()

  // _nuxt and static
  app.use(sigmaContext._nuxt.publicPath, serveStatic(resolve(sigmaContext._nuxt.buildDir, 'dist/client')))
  app.use(sigmaContext._nuxt.routerBase, serveStatic(resolve(sigmaContext._nuxt.staticDir)))

  // Dev Middleware
  let loadingMiddleware, devMiddleware
  const setLoadingMiddleware = (m) => { loadingMiddleware = m }
  const setDevMiddleware = (m) => { devMiddleware = m }
  app.use((req, res, next) => {
    if (loadingMiddleware && req.url.startsWith('/_loading')) {
      req.url = req.url.replace('/_loading', '')
      return loadingMiddleware(req, res)
    }
    if (devMiddleware) {
      return devMiddleware(req, res, next)
    }
    return next()
  })

  // SSR Proxy
  const proxy = createProxy()
  app.use((req, res) => {
    if (workerAddress) {
      proxy.web(req, res, { target: workerAddress }, (_err) => {
        // console.error('[proxy]', err)
      })
    } else if (loadingMiddleware) {
      // TODO:serverIndex method is not exposed
      // loadingMiddleware(req, res)
      sigmaContext._internal.hooks.callHook('renderLoading', req, res)
    } else {
      res.end('Worker not ready!')
    }
  })

  // Listen
  let listeners: Listener[] = []
  const _listen = async (port) => {
    const listener = await listen(app, { port, showURL: false, isProd: true })
    listeners.push(listener)
    return listener
  }

  // Watch for dist and reload worker
  const pattern = '**/*.{js,json}'
  const events = ['add', 'change']
  let watcher
  function watch () {
    if (watcher) { return }
    const dReload = debounce(() => reload().catch(console.warn), 200, true)
    watcher = chokidar.watch([
      resolve(sigmaContext.output.serverDir, pattern),
      resolve(sigmaContext._nuxt.buildDir, 'dist/server', pattern)
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
  sigmaContext._internal.hooks.hook('close', close)

  return {
    reload,
    listen: _listen,
    close,
    watch,
    setLoadingMiddleware,
    setDevMiddleware
  }
}
