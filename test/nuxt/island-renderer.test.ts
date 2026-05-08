import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, provide } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { createHead } from '@unhead/vue/server'
import { headSymbol } from '@unhead/vue'

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
  it('does not mutate the head it inherits from the parent context', async () => {
    const parentHead = createHead()
    parentHead.push({ title: 'Parent route title', meta: [{ name: 'author', content: 'Nuxt' }] })
    const entriesBefore = [...parentHead.entries.values()]
    expect(entriesBefore.length).toBeGreaterThan(0)

    await mountSuspended(defineComponent({
      setup () {
        provide(headSymbol, parentHead)
        return () => h(IslandRenderer, { context: { name: 'DummyIsland' } })
      },
    }))

    const entriesAfter = [...parentHead.entries.values()]
    expect(entriesAfter).toEqual(entriesBefore)
  })
})
