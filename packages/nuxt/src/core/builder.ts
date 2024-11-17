import type { EventType } from '@parcel/watcher'
import type { FSWatcher } from 'chokidar'
import { watch as chokidarWatch } from 'chokidar'
import { importModule, isIgnored, logger, tryResolveModule, useNuxt } from '@nuxt/kit'
import { debounce } from 'perfect-debounce'
import { normalize, relative, resolve } from 'pathe'
import type { Nuxt, NuxtBuilder } from 'nuxt/schema'

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

  if (nuxt.options.dev) {
    checkForExternalConfigurationFiles()
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

  const watcher = chokidarWatch(nuxt.options._layers.map(i => i.config.srcDir as string).filter(Boolean), {
    ...nuxt.options.watchers.chokidar,
    ignoreInitial: true,
    ignored: [
      isIgnored,
      'node_modules',
    ],
  })

  watcher.on('all', (event, path) => nuxt.callHook('builder:watch', event, normalize(path)))
  nuxt.hook('close', () => watcher?.close())
}

function createGranularWatcher () {
  const nuxt = useNuxt()

  if (nuxt.options.debug) {
    // eslint-disable-next-line no-console
    console.time('[nuxt] builder:chokidar:watch')
  }

  let pending = 0

  const ignoredDirs = new Set([...nuxt.options.modulesDir, nuxt.options.buildDir])
  const pathsToWatch = nuxt.options._layers.map(layer => layer.config.srcDir || layer.cwd).filter(d => d && !isIgnored(d))
  for (const pattern of nuxt.options.watch) {
    if (typeof pattern !== 'string') { continue }
    const path = resolve(nuxt.options.srcDir, pattern)
    if (pathsToWatch.some(w => path.startsWith(w.replace(/[^/]$/, '$&/')))) { continue }
    pathsToWatch.push(path)
  }
  for (const dir of pathsToWatch) {
    pending++
    const watcher = chokidarWatch(dir, { ...nuxt.options.watchers.chokidar, ignoreInitial: false, depth: 0, ignored: [isIgnored, '**/node_modules'] })
    const watchers: Record<string, FSWatcher> = {}

    watcher.on('all', (event, path) => {
      path = normalize(path)
      if (!pending) {
        nuxt.callHook('builder:watch', event, path)
      }
      if (event === 'unlinkDir' && path in watchers) {
        watchers[path]?.close()
        delete watchers[path]
      }
      if (event === 'addDir' && path !== dir && !ignoredDirs.has(path) && !pathsToWatch.includes(path) && !(path in watchers) && !isIgnored(path)) {
        const pathWatcher = watchers[path] = chokidarWatch(path, { ...nuxt.options.watchers.chokidar, ignored: [isIgnored] })
        pathWatcher.on('all', (event, p) => nuxt.callHook('builder:watch', event, normalize(p)))
        nuxt.hook('close', () => pathWatcher?.close())
      }
    })
    watcher.on('ready', () => {
      pending--
      if (nuxt.options.debug && !pending) {
        // eslint-disable-next-line no-console
        console.timeEnd('[nuxt] builder:chokidar:watch')
      }
    })
    nuxt.hook('close', () => watcher?.close())
  }
}

async function createParcelWatcher () {
  const nuxt = useNuxt()
  if (nuxt.options.debug) {
    // eslint-disable-next-line no-console
    console.time('[nuxt] builder:parcel:watch')
  }
  const watcherPath = await tryResolveModule('@parcel/watcher', [nuxt.options.rootDir, ...nuxt.options.modulesDir])
  if (!watcherPath) {
    logger.warn('Falling back to `chokidar-granular` as `@parcel/watcher` cannot be resolved in your project.')
    return false
  }

  const { subscribe } = await importModule<typeof import('@parcel/watcher')>(watcherPath)
  for (const layer of nuxt.options._layers) {
    if (!layer.config.srcDir) { continue }
    const watcher = subscribe(layer.config.srcDir, (err, events) => {
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
      if (nuxt.options.debug) {
        // eslint-disable-next-line no-console
        console.timeEnd('[nuxt] builder:parcel:watch')
      }
      nuxt.hook('close', () => subscription.unsubscribe())
    })
  }
  return true
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
  const builderPath = await tryResolveModule(builder, [nuxt.options.rootDir, import.meta.url])

  if (!builderPath) {
    throw new Error(`Loading \`${builder}\` builder failed. You can read more about the nuxt \`builder\` option at: \`https://nuxt.com/docs/api/nuxt-config#builder\``)
  }
  return importModule(builderPath)
}
