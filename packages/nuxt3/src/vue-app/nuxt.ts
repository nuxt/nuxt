import type { IncomingMessage, ServerResponse } from 'http'
import Hookable from 'hookable'
import type { App } from 'vue'

import type { Plugin } from './types'
import { defineGetter } from './utils'

export class Nuxt extends Hookable {
  app: App<Element>
  ssrContext?: Record<string, any>
  globalName: string
  context: {
    req?: IncomingMessage
    res?: ServerResponse
  }

  constructor({ app, ssrContext, globalName }: { app: Nuxt['app'], ssrContext?: Nuxt['ssrContext'], globalName: Nuxt['globalName'] }) {
    super()
    this.app = app
    this.ssrContext = ssrContext
    this.globalName = globalName
  }

  provide(name: string, value: any) {
    const $name = '$' + name
    defineGetter(this.app, $name, value)
    defineGetter(this.app.config.globalProperties, $name, value)
  }
}

interface InitOptions {
  app: Nuxt['app']
  plugins?: Plugin[]
  ssrContext?: Nuxt['ssrContext']
  globalName?: Nuxt['globalName']
}

export async function init({ app, plugins, ssrContext, globalName = 'nuxt' }: InitOptions) {
  const nuxt = new Nuxt({ app, ssrContext, globalName })
  nuxt.provide('nuxt', nuxt)

  const inject: Nuxt['provide'] = nuxt.provide.bind(nuxt)

  for (const plugin of plugins) {
    await plugin(nuxt, inject)
  }
}


declare module 'vue' {
  interface App {
    $nuxt: Nuxt
  }
}
