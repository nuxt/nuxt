import { headSymbol } from '@unhead/vue'
import { defineNuxtPlugin } from '#app/nuxt'
import type { ObjectPlugin, Plugin } from '#app/nuxt'
import { clientHeadFactory, getClientHeadState } from '../client-head-state'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:head',
  enforce: 'pre',
  setup (nuxtApp) {
    const state = getClientHeadState(nuxtApp)
    const resume = () => {
      state.paused = false
      state.render?.()
    }
    nuxtApp.hooks.hook('page:start', () => { state.paused = true })
    // wait for new page before unpausing dom updates (triggered after suspense resolved)
    nuxtApp.hooks.hook('page:finish', () => {
      // app:suspense:resolve hook will unpause the DOM
      if (!nuxtApp.isHydrating) { resume() }
    })
    nuxtApp.hooks.hook('app:error', resume)
    nuxtApp.hooks.hook('app:suspense:resolve', resume)

    // head input hoisted from the app component applies where the app component sets up
    nuxtApp.hooks.hookOnce('vue:setup', () => {
      state.rootSetup = true
      state.pushAppComponentHead?.()
    })

    // the head is created on first use, including through `inject(headSymbol)`
    if (!state.head) {
      Object.defineProperty(nuxtApp.vueApp._context.provides, headSymbol, {
        configurable: true,
        enumerable: true,
        get: () => clientHeadFactory.create?.(nuxtApp),
        set (value) {
          Object.defineProperty(this, headSymbol, { configurable: true, enumerable: true, writable: true, value })
        },
      })
    }
  },
})

export default plugin
