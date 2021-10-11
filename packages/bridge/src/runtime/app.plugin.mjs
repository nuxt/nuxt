import Vue from 'vue'
import { createHooks } from 'hookable/dist/index.mjs'
import { setNuxtAppInstance } from '#app'

export default (ctx, inject) => {
  const nuxt = {
    app: {
      component: Vue.component.bind(Vue),
      config: {
        globalProperties: {}
      },
      directive: Vue.directive.bind(Vue),
      mixin: Vue.mixin.bind(Vue),
      mount: () => {},
      provide: inject,
      unmount: () => {},
      use (vuePlugin) {
        vuePlugin.install(this)
      },
      version: Vue.version
    },
    provide: inject,
    globalName: 'nuxt',
    payload: process.client ? ctx.nuxtState : ctx.ssrContext.nuxt,
    isHydrating: ctx.isHMR,
    legacyNuxt: ctx.app
  }

  nuxt.hooks = createHooks()
  nuxt.hook = nuxt.hooks.hook
  nuxt.callHook = nuxt.hooks.callHook

  if (!Array.isArray(ctx.app.created)) {
    ctx.app.created = [ctx.app.created]
  }

  if (process.server) {
    nuxt.ssrContext = ctx.ssrContext
  }

  ctx.app.created.push(function () {
    nuxt.legacyApp = this
  })

  setNuxtAppInstance(nuxt)

  inject('_nuxtApp', nuxt)
}
