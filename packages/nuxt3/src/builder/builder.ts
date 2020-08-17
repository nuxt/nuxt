import { join } from 'path'
import fsExtra from 'fs-extra'
import { BundleBuilder } from 'src/webpack'
import { Nuxt } from '../core'
import { compileTemplates, scanTemplates, NuxtTemplate } from './template'
import { createWatcher } from './watch'
import { resolveApp, NuxtApp } from './app'

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

  // Watch internal templates
  const nuxtAppWatcher = createWatcher(nuxt.options.appDir)
  // nuxtAppWatcher.debug()
  nuxtAppWatcher.watchAll(async () => {
    console.log('Re-generate templates')
    await compileTemplates(builder.templates, nuxt.options.buildDir)
  })

  // Watch user app
  const appWatcher = createWatcher(builder.app.srcDir, {
    ignored: [
      nuxt.options.buildDir
    ]
  })
  // appWatcher.debug()
  appWatcher.watch(/(A|a)pp\.[a-z]{2,3}/, async () => {
    await new Promise(resolve => setTimeout(resolve, 200))
    await generate(builder)
  })
  appWatcher.watch('pages/', async () => {
    console.log('Re-generate routes')
    await compileTemplates(builder.templates, nuxt.options.buildDir)
  })
}

export async function generate (builder: Builder) {
  const { nuxt } = builder

  await fsExtra.mkdirp(nuxt.options.buildDir)
  builder.app = resolveApp(nuxt, nuxt.options.srcDir)

  const templatesDir = join(builder.nuxt.options.appDir, '_templates')
  const appTemplates = await scanTemplates(templatesDir, {
    app: builder.app
  })

  builder.templates = [
    ...appTemplates
  ]

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
