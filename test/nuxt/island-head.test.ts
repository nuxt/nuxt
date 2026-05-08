import { describe, expect, it, vi } from 'vitest'
import { createHead } from '@unhead/vue/server'

import islandHeadPlugin from '../../packages/nuxt/src/head/runtime/plugins/island-head.server'

vi.mock('#build/unhead-options.mjs', () => ({
  default: {},
}))

// Regression test for #32100. The original fix cleared the injected head's
// entries inside `IslandRenderer.setup`, but Vue's module-global
// `currentInstance` under concurrent prerender can resolve `injectHead()` to a
// different request's head, so `clear()` would wipe an unrelated route's
// entries. The replacement plugin instead swaps `ssrContext.head` for a fresh,
// isolated head when rendering an island, never mutating shared state.
describe('island-head plugin', () => {
  it('does not mutate the route head it inherits via ssrContext', async () => {
    const routeHead = createHead()
    routeHead.push({ title: 'Parent route title', meta: [{ name: 'author', content: 'Nuxt' }] })
    const entriesBefore = [...routeHead.entries.values()]
    expect(entriesBefore.length).toBeGreaterThan(0)

    const fakeNuxtApp = {
      ssrContext: {
        head: routeHead,
        islandContext: { name: 'Dummy', props: {}, slots: {}, components: {} },
      },
      vueApp: { provide: vi.fn() },
    } as any

    // The hook runs synchronously; cast through `any` to invoke the registered setup.
    await (islandHeadPlugin as any)(fakeNuxtApp)

    // Original route head must be untouched.
    expect([...routeHead.entries.values()]).toEqual(entriesBefore)

    // The island request must now point at a fresh, isolated head.
    expect(fakeNuxtApp.ssrContext.head).not.toBe(routeHead)
    expect(fakeNuxtApp.vueApp.provide).toHaveBeenCalledOnce()
  })

  it('is a no-op when not rendering an island', async () => {
    const routeHead = createHead()
    const fakeNuxtApp = {
      ssrContext: { head: routeHead },
      vueApp: { provide: vi.fn() },
    } as any

    await (islandHeadPlugin as any)(fakeNuxtApp)

    expect(fakeNuxtApp.ssrContext.head).toBe(routeHead)
    expect(fakeNuxtApp.vueApp.provide).not.toHaveBeenCalled()
  })
})
