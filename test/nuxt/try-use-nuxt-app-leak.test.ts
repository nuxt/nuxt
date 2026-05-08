import { describe, expect, it } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import { getNuxtAppCtx, tryUseNuxtApp, useNuxtApp } from '#app/nuxt'

// Foreign `currentInstance` (e.g. `<App>` after `withAsyncContext` in concurrent SSR) must not override the ALS-bound nuxtApp.
describe('tryUseNuxtApp leak via Vue currentInstance', () => {
  it('prefers the ALS-bound nuxtApp over a foreign Vue currentInstance', () => {
    const trueNuxtApp = useNuxtApp()

    const ctx = getNuxtAppCtx()
    const previous = ctx.tryUse()
    ctx.set(trueNuxtApp, true)

    const foreignNuxtApp = { _id: 'foreign-nuxt-app' } as any
    let resolvedFromInsideForeignSetup: any

    const foreignVueApp = createApp(defineComponent({
      setup () {
        resolvedFromInsideForeignSetup = tryUseNuxtApp()
        return () => h('div')
      },
    }))

    Object.defineProperty(foreignVueApp, '$nuxt', { value: foreignNuxtApp, configurable: true })
    Object.defineProperty(foreignVueApp.config.globalProperties, '$nuxt', { value: foreignNuxtApp, configurable: true })

    try {
      foreignVueApp.mount(document.createElement('div'))

      expect(resolvedFromInsideForeignSetup).not.toBe(foreignNuxtApp)
      expect(resolvedFromInsideForeignSetup).toBe(trueNuxtApp)
    } finally {
      foreignVueApp.unmount()
      if (previous) {
        ctx.set(previous, true)
      } else {
        ctx.unset()
      }
    }
  })
})
