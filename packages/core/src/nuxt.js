
import { isPlainObject } from 'lodash'
import consola from 'consola'
import Hookable from 'hable'

import { defineAlias } from '@nuxt/utils'
import { getNuxtConfig } from '@nuxt/config'
import { Server } from '@nuxt/server'

import { version } from '../package.json'

import ModuleContainer from './module'
import Resolver from './resolver'

export default class Nuxt extends Hookable {
  constructor (options = {}) {
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
      showReady: 'webpack:done',
      // Introduced in 2.13
      'export:done': 'generate:done',
      'export:before': 'generate:before',
      'export:extendRoutes': 'generate:extendRoutes',
      'export:distRemoved': 'generate:distRemoved',
      'export:distCopied': 'generate:distCopied',
      'export:route': 'generate:route',
      'export:routeFailed': 'generate:routeFailed',
      'export:page': 'generate:page',
      'export:routeCreated': 'generate:routeCreated'
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
    if (isPlainObject(this.options.hooks)) {
      this.addHooks(this.options.hooks)
    } else if (typeof this.options.hooks === 'function') {
      this.options.hooks(this.hook)
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

  async close (callback) {
    await this.callHook('close', this)

    if (typeof callback === 'function') {
      await callback()
    }

    this.clearHooks()
  }
}
