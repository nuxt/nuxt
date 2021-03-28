import type { IncomingHttpHeaders } from 'http'

import { dirname } from 'path'
import isPlainObject from 'lodash/isPlainObject'
import consola from 'consola'
import Hookable from 'hookable'
import { LoadNuxtOptions, loadNuxtConfig } from '@nuxt/kit'
import { version } from '../package.json'

import ModuleContainer from './module'
import Resolver from './resolver'
import { initNitro } from './nitro'

declare global {
  namespace NodeJS {
    interface Global {
      __NUXT_DEV__: boolean
    }
  }
}

export class Nuxt extends Hookable {
  _ready?: Promise<this>
  _initCalled?: boolean

  error?: Error & { statusCode?: number, headers?: IncomingHttpHeaders }
  options: any
  resolver: Resolver
  moduleContainer: ModuleContainer
  server?: any
  renderer?: any
  render?: any['app']
  showReady?: () => void

  constructor (options) {
    super(consola)

    this.options = options

    // Create instance of core components
    this.resolver = new Resolver(this)
    this.moduleContainer = new ModuleContainer(this)

    // Call ready
    if (this.options._ready !== false) {
      this.ready().catch((err) => {
        consola.fatal(err)
      })
    }
  }

  static get version () {
    return `v${version}` + (global.__NUXT_DEV__ ? '-development' : '')
  }

  ready () {
    if (!this._ready) {
      this._ready = this._init()
    }
    return this._ready
  }

  async _init () {
    if (this._initCalled) {
      return this
    }
    this._initCalled = true

    // Add hooks
    if (this.options.hooks instanceof Function) {
      this.options.hooks(this.hook)
    } else if (isPlainObject(this.options.hooks)) {
      this.addHooks(this.options.hooks)
    }

    // Await for server
    await initNitro(this)

    // Await for modules
    await this.moduleContainer.ready()

    // Call ready hook
    await this.callHook('ready', this)

    return this
  }

  async close (callback?: () => any | Promise<any>) {
    await this.callHook('close', this)

    if (typeof callback === 'function') {
      await callback()
    }
  }
}

export async function loadNuxt (opts: LoadNuxtOptions) {
  const options = await loadNuxtConfig(opts)

  // Temp
  options.appDir = dirname(require.resolve('@nuxt/app'))
  options._majorVersion = 3

  const nuxt = new Nuxt(options)
  await nuxt.ready()
  return nuxt
}
