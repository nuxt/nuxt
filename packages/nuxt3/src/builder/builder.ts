import { join, relative } from 'path'
import fsExtra from 'fs-extra'
import consola from 'consola'
import { debounce } from 'lodash'
import { BundleBuilder } from 'src/webpack'
import { Nuxt } from '../core'
import {
  templateData,
  compileTemplates,
  scanTemplates,
  NuxtTemplate
} from './template'
import { createWatcher } from './watch'
import { resolveApp, NuxtApp } from './app'
import Ignore from './ignore'

export class Builder {
  nuxt: Nuxt
  app: NuxtApp
  templates: NuxtTemplate[]

  constructor (nuxt) {
    this.nuxt = nuxt
  }

  build () {
    return build(this)
  }
}

// Extends VueRouter
async function build (builder: Builder) {
  const { nuxt } = builder

  await generate(builder)

  if (nuxt.options.dev) {
    watch(builder)
  }

  await bundle(builder)
}

function watch (builder: Builder) {
  const { nuxt } = builder
  const ignore = new Ignore({
    rootDir: nuxt.options.srcDir,
    ignoreArray: nuxt.options.ignore.concat(
      relative(nuxt.options.rootDir, nuxt.options.buildDir)
    )
  })

  // Watch internal templates
  const options = nuxt.options.watchers.chokidar
  const nuxtAppWatcher = createWatcher(nuxt.options.appDir, options, ignore)
  nuxtAppWatcher.watchAll(async () => {
    consola.log('Re-generate templates')
    await compileTemplates(builder.templates, nuxt.options.buildDir)
  })

  // Watch user app
  const appWatcher = createWatcher(builder.app.srcDir, options, ignore)
  // Watch for App.vue creation
  // appWatcher.debug('srcDir')
  appWatcher.watch(
    /^(A|a)pp\.[a-z]{2,3}/,
    debounce(({ event }) => {
      if (['add', 'unlink'].includes(event)) {
        generate(builder)
      }
    }, 50)
  )
  // Watch for page changes
  appWatcher.watch('pages/', async () => {
    consola.log('Re-generate routes')
    await compileTemplates(builder.templates, nuxt.options.buildDir)
  })
}

export async function generate (builder: Builder) {
  const { nuxt } = builder

  await fsExtra.mkdirp(nuxt.options.buildDir)
  builder.app = resolveApp(nuxt, nuxt.options.srcDir)

  const templatesDir = join(builder.nuxt.options.appDir, '_templates')
  const appTemplates = await scanTemplates(templatesDir, templateData(builder))

  builder.templates = [...appTemplates]

  await compileTemplates(builder.templates, nuxt.options.buildDir)
}

async function bundle ({ nuxt }: Builder) {
  // TODO: get rid of this context and directly pass nuxt to BundleBuilder
  const bundleBuilder = new BundleBuilder({
    nuxt,
    options: nuxt.options,
    buildOptions: nuxt.options.build,
    target: nuxt.options.target,
    plugins: []
  })
  await bundleBuilder.build()
}
