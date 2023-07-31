import type { AddressInfo } from 'node:net'
import type { RequestListener } from 'node:http'
import { relative, resolve } from 'pathe'
import chokidar from 'chokidar'
import { debounce } from 'perfect-debounce'
import type { Nuxt } from '@nuxt/schema'
import { consola } from 'consola'
import { withTrailingSlash } from 'ufo'
import { setupDotenv } from 'c12'

// we are deliberately inlining this code as a backup in case user has `@nuxt/schema<3.7`
import { writeTypes as writeTypesLegacy } from '../../../kit/src/template'
import { showBanner, showVersions } from '../utils/banner'
import { loadKit } from '../utils/kit'
import { importModule } from '../utils/esm'
import { overrideEnv } from '../utils/env'
import { loadNuxtManifest, writeNuxtManifest } from '../utils/nuxt'
import { clearBuildDir } from '../utils/fs'
import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'dev',
    usage: 'npx nuxi dev [rootDir] [--dotenv] [--log-level] [--clipboard] [--open, -o] [--port, -p] [--host, -h] [--https] [--ssl-cert] [--ssl-key]',
    description: 'Run nuxt development server'
  },
  async invoke (args, options = {}) {
    overrideEnv('development')

    const rootDir = resolve(args._[0] || '.')
    showVersions(rootDir)

    await setupDotenv({ cwd: rootDir, fileName: args.dotenv })

    const { loadNuxt, loadNuxtConfig, buildNuxt, writeTypes = writeTypesLegacy } = await loadKit(rootDir)

    const config = await loadNuxtConfig({
      cwd: rootDir,
      overrides: {
        dev: true,
        logLevel: args['log-level'],
        ...(options.overrides || {})
      }
    })

    const { listen } = await import('listhen')
    const { toNodeListener } = await import('h3')
    let currentHandler: RequestListener | undefined
    let loadingMessage = 'Nuxt is starting...'
    const loadingHandler: RequestListener = async (_req, res) => {
      const loadingTemplate = config.devServer.loadingTemplate ?? await importModule('@nuxt/ui-templates', config.modulesDir).then(r => r.loading)
      res.setHeader('Content-Type', 'text/html; charset=UTF-8')
      res.statusCode = 503 // Service Unavailable
      res.end(loadingTemplate({ loading: loadingMessage }))
    }
    const serverHandler: RequestListener = (req, res) => {
      return currentHandler ? currentHandler(req, res) : loadingHandler(req, res)
    }

    const listener = await listen(serverHandler, {
      showURL: false,
      clipboard: args.clipboard,
      open: args.open || args.o,
      port: args.port || args.p || process.env.NUXT_PORT || process.env.NITRO_PORT || config.devServer.port,
      hostname: args.host || args.h || process.env.NUXT_HOST || process.env.NITRO_HOST || config.devServer.host,
      https: (args.https !== false && (args.https || config.devServer.https))
        ? {
            cert: args['ssl-cert'] || process.env.NUXT_SSL_CERT || process.env.NITRO_SSL_CERT || (typeof config.devServer.https !== 'boolean' && config.devServer.https.cert) || undefined,
            key: args['ssl-key'] || process.env.NUXT_SSL_KEY || process.env.NITRO_SSL_KEY || (typeof config.devServer.https !== 'boolean' && config.devServer.https.key) || undefined
          }
        : false
    })

    let currentNuxt: Nuxt
    let distWatcher: chokidar.FSWatcher

    const showURL = () => {
      listener.showURL({
        // TODO: Normalize URL with trailing slash within schema
        baseURL: withTrailingSlash(currentNuxt?.options.app.baseURL) || '/'
      })
    }
    async function hardRestart (reason?: string) {
      if (process.send) {
        await listener.close().catch(() => {})
        await currentNuxt.close().catch(() => {})
        await watcher.close().catch(() => {})
        await distWatcher.close().catch(() => {})
        if (reason) {
          consola.info(`${reason ? reason + '. ' : ''}Restarting nuxt...`)
        }
        process.send({ type: 'nuxt:restart' })
      } else {
        await load(true, reason)
      }
    }
    const load = async (isRestart: boolean, reason?: string) => {
      try {
        loadingMessage = `${reason ? reason + '. ' : ''}${isRestart ? 'Restarting' : 'Starting'} nuxt...`
        currentHandler = undefined
        if (isRestart) {
          consola.info(loadingMessage)
        }
        if (currentNuxt) {
          await currentNuxt.close()
        }
        if (distWatcher) {
          await distWatcher.close()
        }

        currentNuxt = await loadNuxt({
          rootDir,
          dev: true,
          ready: false,
          overrides: {
            logLevel: args['log-level'],
            vite: {
              clearScreen: args.clear
            },
            ...(options.overrides || {})
          }
        })

        if (!isRestart) {
          showURL()
        }

        // Write manifest and also check if we need cache invalidation
        if (!isRestart) {
          const previousManifest = await loadNuxtManifest(currentNuxt.options.buildDir)
          const newManifest = await writeNuxtManifest(currentNuxt)
          if (previousManifest && newManifest && previousManifest._hash !== newManifest._hash) {
            await clearBuildDir(currentNuxt.options.buildDir)
          }
        }

        await currentNuxt.ready()

        distWatcher = chokidar.watch(resolve(currentNuxt.options.buildDir, 'dist'), { ignoreInitial: true, depth: 0 })
        distWatcher.on('unlinkDir', () => {
          dLoad(true, '.nuxt/dist directory has been removed')
        })

        const unsub = currentNuxt.hooks.hook('restart', async (options) => {
          unsub() // we use this instead of `hookOnce` for Nuxt Bridge support
          if (options?.hard) { return hardRestart() }
          await load(true)
        })

        await currentNuxt.hooks.callHook('listen', listener.server, listener)
        const address = (listener.server.address() || {}) as AddressInfo
        currentNuxt.options.devServer.url = listener.url
        currentNuxt.options.devServer.port = address.port
        currentNuxt.options.devServer.host = address.address
        currentNuxt.options.devServer.https = listener.https

        await Promise.all([
          writeTypes(currentNuxt).catch(console.error),
          buildNuxt(currentNuxt)
        ])
        currentHandler = toNodeListener(currentNuxt.server.app)
        if (isRestart && args.clear !== false) {
          showBanner()
          showURL()
        }
      } catch (err) {
        consola.error(`Cannot ${isRestart ? 'restart' : 'start'} nuxt: `, err)
        currentHandler = undefined
        loadingMessage = 'Error while loading nuxt. Please check console and fix errors.'
      }
    }

    // Watch for config changes
    // TODO: Watcher service, modules, and requireTree
    const dLoad = debounce(load)
    const watcher = chokidar.watch([rootDir], { ignoreInitial: true, depth: 0 })
    watcher.on('all', (_event, _file) => {
      const file = relative(rootDir, _file)
      if (file === (args.dotenv || '.env')) { return hardRestart('.env updated') }
      if (RESTART_RE.test(file)) {
        dLoad(true, `${file} updated`)
      }
    })

    await load(false)

    return 'wait' as const
  }
})

const RESTART_RE = /^(nuxt\.config\.(js|ts|mjs|cjs)|\.nuxtignore|\.nuxtrc)$/
