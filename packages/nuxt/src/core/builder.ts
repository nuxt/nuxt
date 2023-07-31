import { pathToFileURL } from 'node:url'
import type { EventType } from '@parcel/watcher'
import type { FSWatcher } from 'chokidar'
import chokidar from 'chokidar'
import { isIgnored, tryResolveModule, useNuxt } from '@nuxt/kit'
import { interopDefault } from 'mlly'
import { debounce } from 'perfect-debounce'
import { normalize, relative, resolve } from 'pathe'
import type { Nuxt } from 'nuxt/schema'

import { generateApp as _generateApp, createApp } from './app'

export async function build (nuxt: Nuxt) {
  const app = createApp(nuxt)
  nuxt.apps.default = app

  const generateApp = debounce(() => _generateApp(nuxt, app), undefined, { leading: true })
  await generateApp()

  if (nuxt.options.dev) {
    watch(nuxt)
    nuxt.hook('builder:watch', async (event, relativePath) => {
      if (event === 'change') { return }
      const path = resolve(nuxt.options.srcDir, relativePath)
      const relativePaths = nuxt.options._layers.map(l => relative(l.config.srcDir || l.cwd, path))
      const restartPath = relativePaths.find(relativePath => /^(app\.|error\.|plugins\/|middleware\/|layouts\/)/i.test(relativePath))
      if (restartPath) {
        if (restartPath.startsWith('app')) {
          app.mainComponent = undefined
        }
        if (restartPath.startsWith('error')) {
          app.errorComponent = undefined
        }
        await generateApp()
      }
    })
    nuxt.hook('builder:generateApp', (options) => {
      // Bypass debounce if we are selectively invalidating templates
      if (options) { return _generateApp(nuxt, app, options) }
      return generateApp()
    })
  }

  await nuxt.callHook('build:before')
  if (!nuxt.options._prepare) {
    await bundle(nuxt)
    await nuxt.callHook('build:done')
  }

  if (!nuxt.options.dev) {
    await nuxt.callHook('close', nuxt)
  }
}

const watchEvents: Record<EventType, 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'> = {
  create: 'add',
  delete: 'unlink',
  update: 'change'
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

  const watcher = chokidar.watch(nuxt.options._layers.map(i => i.config.srcDir as string).filter(Boolean), {
    ...nuxt.options.watchers.chokidar,
    ignoreInitial: true,
    ignored: [
      isIgnored,
      'node_modules'
    ]
  })

  // TODO: consider moving to emit absolute path in 3.8 or 4.0
  watcher.on('all', (event, path) => nuxt.callHook('builder:watch', event, normalize(relative(nuxt.options.srcDir, path))))
  nuxt.hook('close', () => watcher?.close())
}

function createGranularWatcher () {
  const nuxt = useNuxt()

  if (nuxt.options.debug) {
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
    const watcher = chokidar.watch(dir, { ...nuxt.options.watchers.chokidar, ignoreInitial: false, depth: 0, ignored: [isIgnored, '**/node_modules'] })
    const watchers: Record<string, FSWatcher> = {}

    watcher.on('all', (event, path) => {
      path = normalize(path)
      if (!pending) {
        // TODO: consider moving to emit absolute path in 3.8 or 4.0
        nuxt.callHook('builder:watch', event, relative(nuxt.options.srcDir, path))
      }
      if (event === 'unlinkDir' && path in watchers) {
        watchers[path]?.close()
        delete watchers[path]
      }
      if (event === 'addDir' && path !== dir && !ignoredDirs.has(path) && !pathsToWatch.includes(path) && !(path in watchers) && !isIgnored(path)) {
        watchers[path] = chokidar.watch(path, { ...nuxt.options.watchers.chokidar, ignored: [isIgnored] })
        // TODO: consider moving to emit absolute path in 3.8 or 4.0
        watchers[path].on('all', (event, p) => nuxt.callHook('builder:watch', event, normalize(relative(nuxt.options.srcDir, p))))
        nuxt.hook('close', () => watchers[path]?.close())
      }
    })
    watcher.on('ready', () => {
      pending--
      if (nuxt.options.debug && !pending) {
        console.timeEnd('[nuxt] builder:chokidar:watch')
      }
    })
  }
}

async function createParcelWatcher () {
  const nuxt = useNuxt()
  if (nuxt.options.debug) {
    console.time('[nuxt] builder:parcel:watch')
  }
  const watcherPath = await tryResolveModule('@parcel/watcher', [nuxt.options.rootDir, ...nuxt.options.modulesDir])
  if (watcherPath) {
    const { subscribe } = await import(pathToFileURL(watcherPath).href).then(interopDefault) as typeof import('@parcel/watcher')
    for (const layer of nuxt.options._layers) {
      if (!layer.config.srcDir) { continue }
      const watcher = subscribe(layer.config.srcDir, (err, events) => {
        if (err) { return }
        for (const event of events) {
          if (isIgnored(event.path)) { continue }
          // TODO: consider moving to emit absolute path in 3.8 or 4.0
          nuxt.callHook('builder:watch', watchEvents[event.type], normalize(relative(nuxt.options.srcDir, event.path)))
        }
      }, {
        ignore: [
          ...nuxt.options.ignore,
          'node_modules'
        ]
      })
      watcher.then((subscription) => {
        if (nuxt.options.debug) {
          console.timeEnd('[nuxt] builder:parcel:watch')
        }
        nuxt.hook('close', () => subscription.unsubscribe())
      })
    }
    return true
  }
  console.warn('[nuxt] falling back to `chokidar-granular` as `@parcel/watcher` cannot be resolved in your project.')
  return false
}

async function bundle (nuxt: Nuxt) {
  try {
    const { bundle } = typeof nuxt.options.builder === 'string'
      ? await loadBuilder(nuxt, nuxt.options.builder)
      : nuxt.options.builder

    return bundle(nuxt)
  } catch (error: any) {
    await nuxt.callHook('build:error', error)

    if (error.toString().includes('Cannot find module \'@nuxt/webpack-builder\'')) {
      throw new Error([
        'Could not load `@nuxt/webpack-builder`. You may need to add it to your project dependencies, following the steps in `https://github.com/nuxt/framework/pull/2812`.'
      ].join('\n'))
    }

    throw error
  }
}

async function loadBuilder (nuxt: Nuxt, builder: string) {
  const builderPath = await tryResolveModule(builder, [nuxt.options.rootDir, import.meta.url])
  if (builderPath) {
    return import(pathToFileURL(builderPath).href)
  }
}
