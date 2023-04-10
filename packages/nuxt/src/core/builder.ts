import { pathToFileURL } from 'node:url'
import type { EventType } from '@parcel/watcher'
import { subscribe } from '@parcel/watcher'
import { isIgnored, tryResolveModule } from '@nuxt/kit'
import { debounce } from 'perfect-debounce'
import { normalize } from 'pathe'
import type { Nuxt } from 'nuxt/schema'

import { generateApp as _generateApp, createApp } from './app'

export async function build (nuxt: Nuxt) {
  const app = createApp(nuxt)
  const generateApp = debounce(() => _generateApp(nuxt, app), undefined, { leading: true })
  await generateApp()

  if (nuxt.options.dev) {
    watch(nuxt)
    nuxt.hook('builder:watch', async (event, path) => {
      if (event !== 'change' && /^(app\.|error\.|plugins\/|middleware\/|layouts\/)/i.test(path)) {
        if (path.startsWith('app')) {
          app.mainComponent = undefined
        }
        if (path.startsWith('error')) {
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

function watch (nuxt: Nuxt) {
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
        '.nuxt',
        'node_modules'
      ]
    })
    watcher.then((subscription) => {
      nuxt.hook('close', () => subscription.unsubscribe())
    })
  }
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
