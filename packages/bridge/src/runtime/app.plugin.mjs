import Vue from 'vue'
import { createHooks } from 'hookable'
import { callWithNuxt, setNuxtAppInstance } from '#app'

// Reshape payload to match key `useLazyAsyncData` expects
function proxiedState (state) {
  state._asyncData = state._asyncData || {}
  state._errors = state._errors || {}
  return new Proxy(state, {
    get (target, prop) {
      if (prop === 'data') {
        return target._asyncData
      }
      if (prop === '_data') {
        return target.state
      }
      return Reflect.get(target, prop)
    }
  })
}

const runOnceWith = (obj, fn) => {
  if (!obj || !['function', 'object'].includes(typeof obj)) {
    return fn()
  }
  if (obj.__nuxt_installed) { return }
  obj.__nuxt_installed = true
  return fn()
}

export default async (ctx, inject) => {
  const nuxtApp = {
    vueApp: {
      component: (id, definition) => runOnceWith(definition, () => Vue.component(id, definition)),
      config: {
        globalProperties: {}
      },
      directive: (id, definition) => runOnceWith(definition, () => Vue.directive(id, definition)),
      mixin: mixin => runOnceWith(mixin, () => Vue.mixin(mixin)),
      mount: () => { },
      provide: inject,
      unmount: () => { },
      use (vuePlugin) {
        runOnceWith(vuePlugin, () => vuePlugin.install(this))
      },
      version: Vue.version
    },
    provide: inject,
    globalName: 'nuxt',
    payload: proxiedState(process.client ? ctx.nuxtState : ctx.ssrContext.nuxt),
    _asyncDataPromises: [],
    isHydrating: true,
    nuxt2Context: ctx
  }

  nuxtApp.hooks = createHooks()
  nuxtApp.hook = nuxtApp.hooks.hook
  nuxtApp.callHook = nuxtApp.hooks.callHook

  const middleware = await import('#build/middleware').then(r => r.default)
  nuxtApp._middleware = nuxtApp._middleware || {
    global: [],
    named: middleware
  }

  ctx.app.router.beforeEach(async (to, from, next) => {
    nuxtApp._processingMiddleware = true

    for (const middleware of nuxtApp._middleware.global) {
      const result = await callWithNuxt(nuxtApp, middleware, [to, from])
      if (result || result === false) { return next(result) }
    }

    next()
  })

  ctx.app.router.afterEach(() => {
    delete nuxtApp._processingMiddleware
  })

  if (!Array.isArray(ctx.app.created)) {
    ctx.app.created = [ctx.app.created].filter(Boolean)
  }

  if (!Array.isArray(ctx.app.mounted)) {
    ctx.app.mounted = [ctx.app.mounted].filter(Boolean)
  }

  if (process.server) {
    nuxtApp.ssrContext = ctx.ssrContext
  }

  ctx.app.created.push(function () {
    nuxtApp.vue2App = this
  })

  ctx.app.mounted.push(() => { nuxtApp.isHydrating = false })

  const proxiedApp = new Proxy(nuxtApp, {
    get (target, prop) {
      if (prop[0] === '$') {
        return target.nuxt2Context[prop] || target.vue2App?.[prop]
      }
      return Reflect.get(target, prop)
    }
  })

  setNuxtAppInstance(proxiedApp)

  if (process.client) {
    window.onNuxtReady(() => {
      nuxtApp.hooks.callHook('app:mounted', nuxtApp.vueApp)
    })
  }

  inject('_nuxtApp', proxiedApp)
}
