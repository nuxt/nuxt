
import isPlainObject from 'lodash/isPlainObject'
import consola from 'consola'

import { Options, Hookable, defineDeprecateGetter } from '@nuxt/common'
import { Server } from '@nuxt/server'

import { version } from '../package.json'
import ModuleContainer from './module'
import Resolver from './resolver'

export default class Nuxt extends Hookable {
  constructor(options = {}) {
    super()

    // Assign options and apply defaults
    this.options = Options.from(options)

    // Create instance of core components
    this.resolver = new Resolver(this)
    this.moduleContainer = new ModuleContainer(this)
    this.server = new Server(this)

    // Deprecated hooks
    this._deprecatedHooks = {
      'render:context': 'render:routeContext' // #3773
    }

    // Add Legacy aliases
    defineDeprecateGetter(this, 'nuxt.renderer', this.server, 'nuxt.searver')
    defineDeprecateGetter(this, 'nuxt.render', this.server.app, 'nuxt.searver.app')
    defineDeprecateGetter(this, 'nuxt.renderRoute', this.server.renderRoute.bind(this.server), 'nuxt.searver.renderRoute')
    defineDeprecateGetter(this, 'nuxt.renderAndGetWindow', this.server.renderAndGetWindow.bind(this.server), 'nuxt.searver.renderAndGetWindow')
    defineDeprecateGetter(this, 'nuxt.resolveAlias', this.resolver.resolveAlias, 'nuxt.resolver.resolveAlias')
    defineDeprecateGetter(this, 'nuxt.resolvePath', this.resolver.resolvePath, 'nuxt.resolver.resolvePath')
    defineDeprecateGetter(this, 'nuxt.listen', this.server.listen.bind(this.server), 'nuxt.server.listen')
    defineDeprecateGetter(this, 'nuxt.showReady', this.server.showReady.bind(this.server), 'nuxt.server.showReady')

    // Wait for Nuxt to be ready
    this.initialized = false
    this._ready = this.ready().catch((err) => {
      consola.fatal(err)
    })
  }

  static get version() {
    return version
  }

  async ready() {
    if (this._ready) {
      return this._ready
    }

    // Add hooks
    if (isPlainObject(this.options.hooks)) {
      this.addHooks(this.options.hooks)
    } else if (typeof this.options.hooks === 'function') {
      this.options.hooks(this.hook)
    }

    // Await for modules
    await this.moduleContainer.ready()

    // Await for server to be ready
    await this.server.ready()

    this.initialized = true

    // Call ready hook
    await this.callHook('ready', this)

    return this
  }

  async close(callback) {
    await this.callHook('close', this)

    /* istanbul ignore if */
    if (typeof callback === 'function') {
      await callback()
    }
  }
}
