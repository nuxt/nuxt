
import consola from 'consola'

import { sequence } from '@nuxt/utils'

export default class Hookable {
  constructor () {
    this._hooks = {}
    this._deprecatedHooks = {}

    this.hook = this.hook.bind(this)
    this.callHook = this.callHook.bind(this)
  }

  hook (name, fn) {
    if (!name || typeof fn !== 'function') {
      return
    }

    if (this._deprecatedHooks[name]) {
      consola.warn(`${name} hook has been deprecated, please use ${this._deprecatedHooks[name]}`)
      name = this._deprecatedHooks[name]
    }

    this._hooks[name] = this._hooks[name] || []
    this._hooks[name].push(fn)
  }

  async callHook (name, ...args) {
    if (!this._hooks[name]) {
      return
    }

    try {
      await sequence(this._hooks[name], fn => fn(...args))
    } catch (err) {
      name !== 'error' && await this.callHook('error', err)
      consola.fatal(err)
    }
  }

  clearHook (name) {
    if (name) {
      delete this._hooks[name]
    }
  }

  clearHooks () {
    this._hooks = {}
  }

  flatHooks (configHooks, hooks = {}, parentName) {
    Object.keys(configHooks).forEach((key) => {
      const subHook = configHooks[key]
      const name = parentName ? `${parentName}:${key}` : key
      if (typeof subHook === 'object' && subHook !== null) {
        this.flatHooks(subHook, hooks, name)
      } else {
        hooks[name] = subHook
      }
    })
    return hooks
  }

  addHooks (configHooks) {
    const hooks = this.flatHooks(configHooks)
    Object.keys(hooks).filter(Boolean).forEach((key) => {
      [].concat(hooks[key]).forEach(h => this.hook(key, h))
    })
  }
}
