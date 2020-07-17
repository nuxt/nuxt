import Hookable from 'hookable'
import { defineGetter } from './utils'

class Nuxt extends Hookable {
  constructor ({ app, ssrContext, globalName }) {
    super()
    this.app = app
    this.ssrContext = ssrContext
    this.globalName = globalName
  }

  provide (name, value) {
    const $name = '$' + name
    defineGetter(this.app, $name, value)
    defineGetter(this.app.config.globalProperties, $name, value)
  }
}

export async function init ({ app, plugins, ssrContext, globalName = 'nuxt' }) {
  const nuxt = new Nuxt({ app, ssrContext, globalName })
  nuxt.provide('nuxt', nuxt)

  const inject = nuxt.provide.bind(nuxt)

  for (const plugin of plugins) {
    await plugin(nuxt, inject)
  }
}
