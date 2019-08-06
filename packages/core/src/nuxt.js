
import isPlainObject from 'lodash/isPlainObject'
import consola from 'consola'

import { defineAlias } from '@nuxt/utils'
import { getNuxtConfig } from '@nuxt/config'
import { Server } from '@nuxt/server'

import { version } from '../package.json'

import ModuleContainer from './module'
import Hookable from './hookable'
import Resolver from './resolver'

export default class Nuxt extends Hookable {
  constructor (options = {}) {
    super()

    // Assign options and apply defaults
    this.options = getNuxtConfig(options)

    // Create instance of core components
    this.resolver = new Resolver(this)
    this.moduleContainer = new ModuleContainer(this)

    // Deprecated hooks
    this._deprecatedHooks = {
      'render:context': 'render:routeContext',
      'render:routeContext': 'vue-renderer:afterRender',
      'showReady': 'webpack:done' // Workaround to deprecate showReady
    }

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
    return (global.__NUXT && global.__NUXT.version) || `v${version}`
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
