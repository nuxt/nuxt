
import consola from 'consola'

import { sequence } from '@nuxt/utils'

export default class Hookable {
  constructor() {
    this._hooks = {}
    this._deprecatedHooks = {}

    this.hook = this.hook.bind(this)
    this.callHook = this.callHook.bind(this)
  }

  hook(name, fn) {
    if (!name || typeof fn !== 'function') {
      return
    }
    // deprecatedHooks에 있으면
    if (this._deprecatedHooks[name]) {
      consola.warn(`${name} hook has been deprecated, please use ${this._deprecatedHooks[name]}`)
      name = this._deprecatedHooks[name]
    }
    // this._hooks에 name 키로 해서 넣어줌
    this._hooks[name] = this._hooks[name] || []
    // name이 키인 곳에 fn push 함
    this._hooks[name].push(fn)
  }
  
  async callHook(name, ...args) {
    if (!this._hooks[name]) {
      return
    }
    // fn은 어디서 오지..
    try {
      await sequence(this._hooks[name], fn => fn(...args))
    } catch (err) {
      name !== 'error' && await this.callHook('error', err)
      consola.fatal(err)
    }
  }

  clearHook(name) {
    if (name) {
      delete this._hooks[name]
    }
  }

  clearHooks() {
    this._hooks = {}
  }

  flatHooks(configHooks, hooks = {}, parentName) {
    // configHooks의 keys로 configHooks를 forEach로 접근함
    Object.keys(configHooks).forEach((key) => {
      const subHook = configHooks[key]
      // parentName이 있으면 키를 매핑함
      const name = parentName ? `${parentName}:${key}` : key
      if (typeof subHook === 'object' && subHook !== null) {
        // 이거 다시 실행
        this.flatHooks(subHook, hooks, name)
      } else {
        hooks[name] = subHook
      }
    })
    return hooks
  }

  addHooks(configHooks) {
    const hooks = this.flatHooks(configHooks)
    // filter(Boolean)은 false가 될 요소들 걸러줌
    Object.keys(hooks).filter(Boolean).forEach((key) => {
      // key에다가 h 넣어줌
      [].concat(hooks[key]).forEach(h => this.hook(key, h))
    })
  }
}
