import Vue from 'vue'
import { createHooks } from 'hookable'
import { setNuxtAppInstance } from '#app'

// Reshape payload to match key `useLazyAsyncData` expects
function proxiedState (state) {
  state._asyncData = state._asyncData || {}
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

export default (ctx, inject) => {
  const nuxtApp = {
    vueApp: {
      component: Vue.component.bind(Vue),
      config: {
        globalProperties: {}
      },
      directive: Vue.directive.bind(Vue),
      mixin: Vue.mixin.bind(Vue),
      mount: () => { },
      provide: inject,
      unmount: () => { },
      use (vuePlugin) {
        vuePlugin.install(this)
      },
      version: Vue.version
    },
    provide: inject,
    globalName: 'nuxt',
    payload: proxiedState(process.client ? ctx.nuxtState : ctx.ssrContext.nuxt),
    _asyncDataPromises: [],
    isHydrating: ctx.isHMR,
    nuxt2Context: ctx
  }

  nuxtApp.hooks = createHooks()
  nuxtApp.hook = nuxtApp.hooks.hook
  nuxtApp.callHook = nuxtApp.hooks.callHook

  if (!Array.isArray(ctx.app.created)) {
    ctx.app.created = [ctx.app.created]
  }

  if (process.server) {
    nuxtApp.ssrContext = ctx.ssrContext
  }

  ctx.app.created.push(function () {
    nuxtApp.vue2App = this
  })

  const proxiedApp = new Proxy(nuxtApp, {
    get (target, prop) {
      if (prop[0] === '$') {
        return target.nuxt2Context[prop] || target.vue2App?.[prop]
      }
      return Reflect.get(target, prop)
    }
  })

  setNuxtAppInstance(proxiedApp)

  inject('_nuxtApp', proxiedApp)
}
