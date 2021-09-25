import { createHooks } from 'hookable/dist/index.mjs'
import { setNuxtInstance } from '#app'

export default (ctx, inject) => {
  const nuxt = {
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

  ctx.app.created.push(function () {
    nuxt.legacyApp = this
  })

  setNuxtInstance(nuxt)

  inject('_nuxtApp', nuxt)
}
