import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { createHead } from '@unhead/vue/server'

import IslandRenderer from '../../packages/nuxt/src/app/components/island-renderer'

vi.mock('#build/components.islands.mjs', () => ({
  islandComponents: {
    DummyIsland: defineComponent({
      name: 'DummyIsland',
      setup () {
        return () => h('div', 'island')
      },
    }),
  },
}))

vi.mock('#build/unhead-options.mjs', () => ({
  default: {},
}))

describe('IslandRenderer', () => {
  // Regression test for #32100: clearing the injected head wiped out a parent
  // route's head entries during concurrent prerender, because Vue's module-level
  // `currentInstance` could resolve `injectHead()` to a different request's head.
  // We simulate that cross-request resolution by pointing `nuxtApp.ssrContext.head`
  // at the route head (this matches the lookup path used by `injectHead()` in Nuxt).
  it('does not mutate the route head it inherits via ssrContext', async () => {
    const routeHead = createHead()
    routeHead.push({ title: 'Parent route title', meta: [{ name: 'author', content: 'Nuxt' }] })
    const entriesBefore = [...routeHead.entries.values()]
    expect(entriesBefore.length).toBeGreaterThan(0)

    const nuxtApp = useNuxtApp()
    const previousSsrContext = nuxtApp.ssrContext
    nuxtApp.ssrContext = { ...(previousSsrContext || {}), head: routeHead, modules: new Set() } as any

    try {
      await mountSuspended(defineComponent({
        setup () {
          return () => h(IslandRenderer, { context: { name: 'DummyIsland' } })
        },
      }))
    } finally {
      nuxtApp.ssrContext = previousSsrContext
    }

    const entriesAfter = [...routeHead.entries.values()]
    expect(entriesAfter).toEqual(entriesBefore)
  })
})
