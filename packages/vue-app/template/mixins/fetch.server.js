import Vue from 'vue'
import { hasFetch, normalizeError, getDataDiff, addLifecycleHook } from '../utils'

async function serverPrefetch() {
  if (!this._fetchOnServer) {
    return
  }

  // Watch data mutations during fetch call
  const [data, diff] = watchDiff(vm._data)
  vm._data = data

  // Call and await on $fetch
  try {
    await this.$options.fetch.call(this)
  } catch (err) {
    this.$fetchState.error = normalizeError(err)
  }

  // Define an ssrKey for hydration
  this._ssrKey = this.$ssrContext.nuxt.data.length

  // Add data-ssr-key on parent element of Component
  const attrs = this.$vnode.data.attrs = this.$vnode.data.attrs || {}
  attrs['data-ssr-key'] = this._ssrKey

  // Call asyncData & add to ssrContext for window.__NUXT__.asyncData
  this.$ssrContext.nuxt.data.push(this.$fetchState.error ? { _error: this.$fetchState.error } : diff)
}

function isObject(obj) {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj)
}

function isPrimitive(val) {
  return val !== Object(val);
}

function watchDiff(obj) {
  const diff = {}

  const watchedProps = new Set()

  const proxy = new Proxy(obj, {
    get(_, prop) {
      const value = obj[prop]

      // Skip already watched props and hidden props like __ob__
      if (prop[0] == '_' || watchedProps.has(prop)) {
        return value
      }

      // Lazy deep-watch
      if (isObject(value)) {
        const [_value, _diff] = _watchDiff(value)
        watchedProps.add(prop)
        obj[prop] = _value
        diff[prop] = _diff
        return _value
      } else if (value !== undefined && !isPrimitive(value)) {
        // We can't predict mutations so always mark as dirty
        diff[prop] = value
      }

      return value
    },
    set(_, prop, val) {
      obj[prop] = val
      if (prop[0] !== '_') {
        diff[prop] = val
      }
      return true
    }
  })

  return [proxy, diff]
}

export default {
  beforeCreate() {
    this._hasFetch = hasFetch(this)
    if (!this._hasFetch) {
      return
    }

    this._fetchOnServer = this.$options.fetchOnServer !== false

    Vue.util.defineReactive(this, '$fetchState', {
      pending: !this._fetchOnServer,
      error: null,
      timestamp: Date.now()
    })

    addLifecycleHook(this, 'serverPrefetch', serverPrefetch)
  }
}
