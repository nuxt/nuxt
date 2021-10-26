import Vue from 'vue'
import { createHooks } from 'hookable'
import { setNuxtAppInstance } from '#app'

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
      use(vuePlugin) {
        vuePlugin.install(this)
      },
      version: Vue.version
    },
    provide: inject,
    globalName: 'nuxt',
    payload: process.client ? ctx.nuxtState : ctx.ssrContext.nuxt,
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

  setNuxtAppInstance(nuxtApp)

  inject('_nuxtApp', nuxtApp)
}
