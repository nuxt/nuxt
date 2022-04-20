import chokidar from 'chokidar'
import type { Nuxt } from '@nuxt/schema'
import { importModule, isIgnored } from '@nuxt/kit'
import { debounce } from 'perfect-debounce'
import { normalize } from 'pathe'
import { createApp, generateApp as _generateApp } from './app'

export async function build (nuxt: Nuxt) {
  const app = createApp(nuxt)
  const generateApp = debounce(() => _generateApp(nuxt, app), undefined, { leading: true })
  await generateApp()

  if (nuxt.options.dev) {
    watch(nuxt)
    nuxt.hook('builder:watch', async (event, path) => {
      if (event !== 'change' && /app|error|plugins/i.test(path)) {
        if (path.match(/app/i)) {
          app.mainComponent = null
        }
        if (path.match(/error/i)) {
          app.errorComponent = null
        }
        await generateApp()
      }
    })
    nuxt.hook('builder:generateApp', generateApp)
  }

  await nuxt.callHook('build:before', { nuxt }, nuxt.options.build)
  if (!nuxt.options._prepare) {
    await bundle(nuxt)
    await nuxt.callHook('build:done', { nuxt })
  }

  if (!nuxt.options.dev) {
    await nuxt.callHook('close', nuxt)
  }
}

function watch (nuxt: Nuxt) {
  const watcher = chokidar.watch(nuxt.options.srcDir, {
    ...nuxt.options.watchers.chokidar,
    cwd: nuxt.options.srcDir,
    ignoreInitial: true,
    ignored: [
      isIgnored,
      '.nuxt',
      'node_modules'
    ]
  })

  const watchHook = debounce((event: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir', path: string) => nuxt.callHook('builder:watch', event, normalize(path)))
  watcher.on('all', watchHook)
  nuxt.hook('close', () => watcher.close())
  return watcher
}

async function bundle (nuxt: Nuxt) {
  try {
    const { bundle } = typeof nuxt.options.builder === 'string'
      ? await importModule(nuxt.options.builder, { paths: nuxt.options.rootDir })
      : nuxt.options.builder

    return bundle(nuxt)
  } catch (error) {
    await nuxt.callHook('build:error', error)

    if (error.toString().includes('Cannot find module \'@nuxt/webpack-builder\'')) {
      throw new Error([
        'Could not load `@nuxt/webpack-builder`. You may need to add it to your project dependencies, following the steps in `https://github.com/nuxt/framework/pull/2812`.'
      ].join('\n'))
    }

    throw error
  }
}
