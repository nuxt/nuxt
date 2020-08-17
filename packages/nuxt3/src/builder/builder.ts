import { BundleBuilder } from 'src/webpack'
import { Nuxt } from '../core'
import { copyTemplates } from './template'
import { resolveApp, NuxtApp } from './app'

export class Builder {
  nuxt: Nuxt
  app: NuxtApp

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

  builder.app = resolveApp(nuxt, nuxt.options.srcDir)
  await copyTemplates(builder)

  await bundle(builder)
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
