import type { EventType } from '@parcel/watcher'
import type { FSWatcher } from 'chokidar'
import { watch as chokidarWatch } from 'chokidar'
import { createIsIgnored, directoryToURL, importModule, isIgnored, useNuxt } from '@nuxt/kit'
import { debounce } from 'perfect-debounce'
import { dirname, join, normalize, relative, resolve } from 'pathe'
import type { Nuxt, NuxtBuilder } from 'nuxt/schema'

import { isDirectory, logger } from '../utils'
import { generateApp as _generateApp, createApp } from './app'
import { checkForExternalConfigurationFiles } from './external-config-files'
import { cleanupCaches, getVueHash } from './cache'

export async function build (nuxt: Nuxt) {
  const app = createApp(nuxt)
  nuxt.apps.default = app

  const generateApp = debounce(() => _generateApp(nuxt, app), undefined, { leading: true })
  await generateApp()

  if (nuxt.options.dev) {
    watch(nuxt)
    nuxt.hook('builder:watch', async (event, relativePath) => {
      // Unset mainComponent and errorComponent if app or error component is changed
      if (event === 'add' || event === 'unlink') {
        const path = resolve(nuxt.options.srcDir, relativePath)
        for (const layer of nuxt.options._layers) {
          const relativePath = relative(layer.config.srcDir || layer.cwd, path)
          if (relativePath.match(/^app\./i)) {
            app.mainComponent = undefined
            break
          }
          if (relativePath.match(/^error\./i)) {
            app.errorComponent = undefined
            break
          }
        }
      }

      // Recompile app templates
      await generateApp()
    })
    nuxt.hook('builder:generateApp', (options) => {
      // Bypass debounce if we are selectively invalidating templates
      if (options) { return _generateApp(nuxt, app, options) }
      return generateApp()
    })
  }

  if (!nuxt.options._prepare && !nuxt.options.dev && nuxt.options.experimental.buildCache) {
    const { restoreCache, collectCache } = await getVueHash(nuxt)
    if (await restoreCache()) {
      await nuxt.callHook('build:done')
      return await nuxt.callHook('close', nuxt)
    }
    nuxt.hooks.hookOnce('nitro:build:before', () => collectCache())
    nuxt.hooks.hookOnce('close', () => cleanupCaches(nuxt))
  }

  await nuxt.callHook('build:before')
  if (nuxt.options._prepare) {
    nuxt.hook('prepare:types', () => nuxt.close())
    return
  }

  if (nuxt.options.dev && !nuxt.options.test) {
    nuxt.hooks.hookOnce('build:done', () => {
      checkForExternalConfigurationFiles()
        .catch(e => logger.warn('Problem checking for external configuration files.', e))
    })
  }

  await bundle(nuxt)

  await nuxt.callHook('build:done')

  if (!nuxt.options.dev) {
    await nuxt.callHook('close', nuxt)
  }
}

const watchEvents: Record<EventType, 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'> = {
  create: 'add',
  delete: 'unlink',
  update: 'change',
}

async function watch (nuxt: Nuxt) {
  if (nuxt.options.experimental.watcher === 'parcel') {
    const success = await createParcelWatcher()
    if (success) { return }
  }

  if (nuxt.options.experimental.watcher === 'chokidar') {
    return createWatcher()
  }

  return createGranularWatcher()
}

function createWatcher () {
  const nuxt = useNuxt()
  const isIgnored = createIsIgnored(nuxt)

  const watcher = chokidarWatch(nuxt.options._layers.map(i => i.config.srcDir as string).filter(Boolean), {
    ...nuxt.options.watchers.chokidar,
    ignoreInitial: true,
    ignored: [isIgnored, /[\\/]node_modules[\\/]/],
  })

  const restartPaths = new Set<string>()
  const srcDir = nuxt.options.srcDir.replace(/\/?$/, '/')
  for (const pattern of nuxt.options.watch) {
    if (typeof pattern !== 'string') { continue }
    const path = resolve(nuxt.options.srcDir, pattern)
    if (!path.startsWith(srcDir)) {
      restartPaths.add(path)
    }
  }

  watcher.add([...restartPaths])

  watcher.on('all', (event, path) => {
    if (event === 'all' || event === 'ready' || event === 'error' || event === 'raw') {
      return
    }
    nuxt.callHook('builder:watch', event, normalize(path))
  })
  nuxt.hook('close', () => watcher?.close())
}

function createGranularWatcher () {
  const nuxt = useNuxt()
  const isIgnored = createIsIgnored(nuxt)

  if (nuxt.options.debug && nuxt.options.debug.watchers) {
    // eslint-disable-next-line no-console
    console.time('[nuxt] builder:chokidar:watch')
  }

  let pending = 0

  const ignoredDirs = new Set([...nuxt.options.modulesDir, nuxt.options.buildDir])
  const pathsToWatch = resolvePathsToWatch(nuxt)
  for (const dir of pathsToWatch) {
    pending++
    const watcher = chokidarWatch(dir, { ...nuxt.options.watchers.chokidar, ignoreInitial: false, depth: 0, ignored: [isIgnored, /[\\/]node_modules[\\/]/] })
    const watchers: Record<string, FSWatcher> = {}

    watcher.on('all', (event, path) => {
      if (event === 'all' || event === 'ready' || event === 'error' || event === 'raw') {
        return
      }
      path = normalize(path)
      if (!pending) {
        nuxt.callHook('builder:watch', event, path)
      }
      if (event === 'unlinkDir' && path in watchers) {
        watchers[path]?.close()
        delete watchers[path]
      }
      if (event === 'addDir' && path !== dir && !ignoredDirs.has(path) && !pathsToWatch.has(path) && !(path in watchers) && !isIgnored(path)) {
        const pathWatcher = watchers[path] = chokidarWatch(path, { ...nuxt.options.watchers.chokidar, ignored: [isIgnored] })
        pathWatcher.on('all', (event, p) => {
          if (event === 'all' || event === 'ready' || event === 'error' || event === 'raw') {
            return
          }
          nuxt.callHook('builder:watch', event, normalize(p))
        })
        nuxt.hook('close', () => pathWatcher?.close())
      }
    })
    watcher.on('ready', () => {
      pending--
      if (nuxt.options.debug && nuxt.options.debug.watchers && !pending) {
        // eslint-disable-next-line no-console
        console.timeEnd('[nuxt] builder:chokidar:watch')
      }
    })
    nuxt.hook('close', () => watcher?.close())
  }
}

async function createParcelWatcher () {
  const nuxt = useNuxt()
  if (nuxt.options.debug && nuxt.options.debug.watchers) {
    // eslint-disable-next-line no-console
    console.time('[nuxt] builder:parcel:watch')
  }
  try {
    const { subscribe } = await importModule<typeof import('@parcel/watcher')>('@parcel/watcher', { url: [nuxt.options.rootDir, ...nuxt.options.modulesDir].map(d => directoryToURL(d)) })
    const pathsToWatch = resolvePathsToWatch(nuxt, { parentDirectories: true })
    for (const dir of pathsToWatch) {
      if (!await isDirectory(dir)) { continue }
      const watcher = subscribe(dir, (err, events) => {
        if (err) { return }
        for (const event of events) {
          if (isIgnored(event.path)) { continue }
          nuxt.callHook('builder:watch', watchEvents[event.type], normalize(event.path))
        }
      }, {
        ignore: [
          ...nuxt.options.ignore,
          'node_modules',
        ],
      })
      watcher.then((subscription) => {
        if (nuxt.options.debug && nuxt.options.debug.watchers) {
        // eslint-disable-next-line no-console
          console.timeEnd('[nuxt] builder:parcel:watch')
        }
        nuxt.hook('close', () => subscription.unsubscribe())
      })
    }
    return true
  } catch {
    logger.warn('Falling back to `chokidar-granular` as `@parcel/watcher` cannot be resolved in your project.')
    return false
  }
}

async function bundle (nuxt: Nuxt) {
  try {
    const { bundle } = typeof nuxt.options.builder === 'string'
      ? await loadBuilder(nuxt, nuxt.options.builder)
      : nuxt.options.builder

    await bundle(nuxt)
  } catch (error: any) {
    await nuxt.callHook('build:error', error)

    if (error.toString().includes('Cannot find module \'@nuxt/webpack-builder\'')) {
      throw new Error('Could not load `@nuxt/webpack-builder`. You may need to add it to your project dependencies, following the steps in `https://github.com/nuxt/framework/pull/2812`.')
    }

    throw error
  }
}

async function loadBuilder (nuxt: Nuxt, builder: string): Promise<NuxtBuilder> {
  try {
    return await importModule(builder, { url: [directoryToURL(nuxt.options.rootDir), new URL(import.meta.url)] })
  } catch {
    throw new Error(`Loading \`${builder}\` builder failed. You can read more about the nuxt \`builder\` option at: \`https://nuxt.com/docs/api/nuxt-config#builder\``)
  }
}

function resolvePathsToWatch (nuxt: Nuxt, opts: { parentDirectories?: boolean } = {}): Set<string> {
  const pathsToWatch = new Set<string>()
  for (const layer of nuxt.options._layers) {
    const dir = layer.config.srcDir || layer.cwd
    if (!dir || isIgnored(dir)) { continue }

    pathsToWatch.add(dir.replace(/[^/]$/, '$&/'))
  }
  for (const pattern of nuxt.options.watch) {
    if (typeof pattern !== 'string') { continue }
    const path = opts?.parentDirectories
      ? join(dirname(resolve(nuxt.options.srcDir, pattern)), '')
      : resolve(nuxt.options.srcDir, pattern)
    let shouldAdd = true
    for (const w of [...pathsToWatch]) {
      if (w.startsWith(path)) {
        pathsToWatch.delete(w)
      }
      if (path.startsWith(w)) {
        shouldAdd = false
      }
    }
    if (shouldAdd) {
      pathsToWatch.add(path)
    }
  }
  return pathsToWatch
}
