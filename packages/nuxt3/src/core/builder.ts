import chokidar from 'chokidar'
import type { Nuxt } from '@nuxt/schema'
import { isIgnored, tryImportModule } from '@nuxt/kit'
import { createApp, generateApp } from './app'

export async function build (nuxt: Nuxt) {
  const app = createApp(nuxt)
  await generateApp(nuxt, app)

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
        await generateApp(nuxt, app)
      }
    })
    nuxt.hook('builder:generateApp', () => generateApp(nuxt, app))
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
  const watchHook = (event, path) => nuxt.callHook('builder:watch', event, path)
  watcher.on('all', watchHook)
  nuxt.hook('close', () => watcher.close())
  return watcher
}

async function bundle (nuxt: Nuxt) {
  const { bundle } = typeof nuxt.options.builder === 'string'
    ? await tryImportModule(nuxt.options.builder, { paths: nuxt.options.rootDir })
    : nuxt.options.builder
  try {
    return bundle(nuxt)
  } catch (error) {
    await nuxt.callHook('build:error', error)
    throw error
  }
}
