
import isPlainObject from 'lodash/isPlainObject'
import consola from 'consola'
import Hookable from 'hookable'

import { defineAlias } from 'src/utils'
import { getNuxtConfig, Configuration, NormalizedConfiguration } from 'src/config'
import { Server } from 'src/server'

import { version } from '../../package.json'

import ModuleContainer from './module'
import Resolver from './resolver'

declare global {
  var __NUXT_DEV__: boolean
}

export default class Nuxt extends Hookable {
  _ready?: Promise<this>
  _initCalled?: boolean

  options: NormalizedConfiguration
  resolver: Resolver
  moduleContainer: ModuleContainer
  server?: Server
  renderer?: Server
  render?: Server['app']
  showReady?: () => void

  constructor (options: Configuration = {}) {
    super(consola)

    // Assign options and apply defaults
    this.options = getNuxtConfig(options)

    // Create instance of core components
    this.resolver = new Resolver(this)
    this.moduleContainer = new ModuleContainer(this)

    // Deprecated hooks
    this.deprecateHooks({
      // #3294 - 7514db73b25c23b8c14ebdafbb4e129ac282aabd
      'render:context': {
        to: '_render:context',
        message: '`render:context(nuxt)` is deprecated, Please use `vue-renderer:ssr:context(context)`'
      },
      // #3773
      'render:routeContext': {
        to: '_render:context',
        message: '`render:routeContext(nuxt)` is deprecated, Please use `vue-renderer:ssr:context(context)`'
      },
      showReady: 'webpack:done'
    })

    // Add Legacy aliases
    defineAlias(this, this.resolver, ['resolveAlias', 'resolvePath'])
    this.showReady = () => { this.callHook('webpack:done') }

    // Init server
    if (this.options.server !== false) {
      this._initServer()
    }

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

    // Await for modules
    await this.moduleContainer.ready()

    // Await for server to be ready
    if (this.server) {
      await this.server.ready()
    }

    // Call ready hook
    await this.callHook('ready', this)

    return this
  }

  _initServer () {
    if (this.server) {
      return
    }
    this.server = new Server(this)
    this.renderer = this.server
    this.render = this.server.app
    defineAlias(this, this.server, ['renderRoute', 'renderAndGetWindow', 'listen'])
  }

  async close (callback?: () => any | Promise<any>) {
    await this.callHook('close', this)

    if (typeof callback === 'function') {
      await callback()
    }
  }
}
