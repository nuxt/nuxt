import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
// @ts-expect-error withAsyncContext is internal API
import { createApp, defineComponent, getCurrentInstance, h, withAsyncContext as vueWithAsyncContext } from 'vue'
import { getNuxtAppCtx, tryUseNuxtApp, useNuxtApp } from '#app/nuxt'
import { clearVueCurrentInstance } from '../../packages/nitro-server/src/runtime/utils/renderer/clear-instance'

// Vue's `withAsyncContext` (emitted for top-level `await` in `<script setup>`)
// restores `currentInstance` on resume but never unsets it, so it stays pointing
// at the suspended component until the next `setup()` overwrites it.
function mountLeakingComponent (onResume: () => void) {
  const app = createApp(defineComponent({
    async setup () {
      const [awaitable, restore] = vueWithAsyncContext(() => Promise.resolve())
      await awaitable
      restore()
      onResume()
      return () => h('div')
    },
  }))
  app.mount(document.createElement('div'))
  return app
}

describe('tryUseNuxtApp', () => {
  it('returns the context-bound app when currentInstance is leaked', async () => {
    const trueNuxtApp = useNuxtApp()
    const ctx = getNuxtAppCtx()
    const previous = ctx.tryUse()
    ctx.set(trueNuxtApp, true)

    const foreignNuxtApp = { _id: 'foreign-nuxt-app' } as any
    let observed: any

    const app = mountLeakingComponent(() => {
      observed = tryUseNuxtApp()
    })
    Object.defineProperty(app, '$nuxt', { value: foreignNuxtApp, configurable: true })
    Object.defineProperty(app.config.globalProperties, '$nuxt', { value: foreignNuxtApp, configurable: true })

    try {
      await flushPromises()
      expect(observed).toBe(trueNuxtApp)
    } finally {
      app.unmount()
      if (previous) {
        ctx.set(previous, true)
      } else {
        ctx.unset()
      }
    }
  })
})

describe('clearVueCurrentInstance', () => {
  it('clears the instance leaked by withAsyncContext', async () => {
    let leaked: unknown
    let afterClear: unknown

    const app = mountLeakingComponent(() => {
      leaked = getCurrentInstance()
      clearVueCurrentInstance()
      afterClear = getCurrentInstance()
    })

    try {
      await flushPromises()
      expect(leaked).toBeTruthy()
      expect(afterClear).toBeNull()
    } finally {
      app.unmount()
    }
  })

  it('is a no-op when no instance is active', () => {
    expect(getCurrentInstance()).toBeNull()
    expect(() => clearVueCurrentInstance()).not.toThrow()
    expect(getCurrentInstance()).toBeNull()
  })
})
