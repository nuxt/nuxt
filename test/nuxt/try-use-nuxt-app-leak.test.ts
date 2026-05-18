import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
// @ts-expect-error withAsyncContext is internal API
import { createApp, defineComponent, h, withAsyncContext as vueWithAsyncContext } from 'vue'
import { getNuxtAppCtx, tryUseNuxtApp, useNuxtApp } from '#app/nuxt'

// Drives the production leak path: Vue's compiler transform for top-level `await`
// in `<script setup>` emits `withAsyncContext`, which restores `currentInstance`
// on resume but never re-unsets it. After `__restore()`, `currentInstance` keeps
// pointing at the suspended component until another `setup()` overwrites it.
//
// Under concurrent prerender, a different request's plugin code calling
// `useNuxtApp()` during that window reads the leaked `currentInstance`. The
// authoritative per-request scope is the Nuxt ALS context, not Vue's module-
// global, so `tryUseNuxtApp` must consult ALS first.
describe('tryUseNuxtApp under Vue withAsyncContext leak', () => {
  it('returns the ALS-bound nuxtApp even when currentInstance is leaked by withAsyncContext', async () => {
    const trueNuxtApp = useNuxtApp()
    const ctx = getNuxtAppCtx()
    const previous = ctx.tryUse()
    ctx.set(trueNuxtApp, true)

    const foreignNuxtApp = { _id: 'foreign-nuxt-app' } as any
    let observedAfterRestore: any

    const foreignVueApp = createApp(defineComponent({
      async setup () {
        // Mirrors the compiled output of `await foo()` in `<script setup>`:
        //   [__temp, __restore] = withAsyncContext(() => foo())
        //   __temp = await __temp
        //   __restore()
        const [awaitable, restore] = vueWithAsyncContext(() => Promise.resolve())
        await awaitable
        restore()
        // currentInstance is now this foreign component (leaked) — and stays
        // leaked until another setup() overwrites it. Any code in this synchronous
        // slice that calls useNuxtApp() reads the leaked global.
        observedAfterRestore = tryUseNuxtApp()
        return () => h('div')
      },
    }))

    Object.defineProperty(foreignVueApp, '$nuxt', { value: foreignNuxtApp, configurable: true })
    Object.defineProperty(foreignVueApp.config.globalProperties, '$nuxt', { value: foreignNuxtApp, configurable: true })

    try {
      foreignVueApp.mount(document.createElement('div'))
      await flushPromises()

      expect(observedAfterRestore).not.toBe(foreignNuxtApp)
      expect(observedAfterRestore).toBe(trueNuxtApp)
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
