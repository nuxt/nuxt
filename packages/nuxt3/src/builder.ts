import { join, relative } from 'path'
import fsExtra from 'fs-extra'
import { debounce } from 'lodash'
import { Nuxt } from '@nuxt/kit'

import {
  templateData,
  compileTemplates,
  scanTemplates,
  NuxtTemplate
} from './template'
import { createWatcher, WatchCallback } from './watch'
import { createApp, NuxtApp } from './app'
import Ignore from './utils/ignore'

export class Builder {
  nuxt: Nuxt
  globals: any
  ignore: Ignore
  templates: NuxtTemplate[]
  app: NuxtApp

  constructor (nuxt: Nuxt) {
    this.nuxt = nuxt
    this.ignore = new Ignore({
      rootDir: nuxt.options.srcDir,
      ignoreArray: nuxt.options.ignore.concat(
        relative(nuxt.options.rootDir, nuxt.options.buildDir)
      )
    })
  }

  build () {
    return _build(this)
  }

  close () {
    // TODO: close watchers
  }
}

// Extends VueRouter
async function _build (builder: Builder) {
  const { nuxt } = builder

  if (!nuxt.options.dev) {
    await fsExtra.emptyDir(nuxt.options.buildDir)
  }
  await generate(builder)

  if (nuxt.options.dev) {
    watch(builder)
  }

  await bundle(builder)

  await nuxt.callHook('build:done', builder)
}

function watch (builder: Builder) {
  const { nuxt, ignore } = builder

  // Watch internal templates
  const options = nuxt.options.watchers.chokidar
  const nuxtAppWatcher = createWatcher(nuxt.options.appDir, { ...options, cwd: nuxt.options.appDir }, ignore)
  nuxtAppWatcher.watchAll(debounce(() => compileTemplates(builder.templates, nuxt.options.buildDir), 100))

  // Watch user app
  // TODO: handle multiples app dirs
  const appPattern = `${builder.app.dir}/**/*{${nuxt.options.extensions.join(',')}}`
  const appWatcher = createWatcher(appPattern, { ...options, cwd: builder.app.dir }, ignore)
  // appWatcher.debug('srcDir')
  const refreshTemplates = debounce(() => generate(builder), 100)
  // Watch for App.vue creation
  appWatcher.watch(/^(A|a)pp\.[a-z]{2,3}/, refreshTemplates, ['add', 'unlink'])
  // Watch for page changes
  appWatcher.watch(new RegExp(`^${nuxt.options.dir.pages}/`), refreshTemplates, ['add', 'unlink'])
  // Watch for plugins changes
  appWatcher.watch(/^plugins/, refreshTemplates, ['add', 'unlink'])

  // Shared Watcher
  const watchHook: WatchCallback = (event, path) => builder.nuxt.callHook('builder:watch', event, path)
  const watchHookDebounced = debounce(watchHook, 100)
  appWatcher.watchAll(watchHookDebounced)
  nuxtAppWatcher.watchAll(watchHookDebounced)
}

export async function generate (builder: Builder) {
  const { nuxt } = builder

  builder.app = await createApp(builder)
  // Todo: Call app:created hook

  const templatesDir = join(builder.nuxt.options.appDir, '_templates')
  const appTemplates = await scanTemplates(templatesDir, templateData(builder))
  // Todo: Call app:templates hook

  builder.templates = [...appTemplates]

  await compileTemplates(builder.templates, nuxt.options.buildDir)
}

async function bundle ({ nuxt }: Builder) {
  // @ts-ignore
  const useVite = !!nuxt.options.vite
  const { bundle } = await (useVite ? import('@nuxt/vite-builder') : import('@nuxt/webpack-builder'))
  return bundle(nuxt)
}

export function getBuilder (nuxt: Nuxt) {
  return new Builder(nuxt)
}

export function build (nuxt: Nuxt) {
  return getBuilder(nuxt).build()
}
