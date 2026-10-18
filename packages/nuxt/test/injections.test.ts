import { describe, expect, it } from 'vitest'
import { createRenderer, defineComponent, h, inject, provide } from 'vue'

import { LayoutMetaSymbol, LayoutSymbol, PageRouteSymbol } from '../src/app/components/injections'

// Layers can end up with a second copy of the Nuxt runtime (e.g. when a
// package manager cannot dedupe the layer's `nuxt` dependency with the app's).
// Both copies must share the same injection keys, or `inject()` in one copy
// misses `provide()` from the other and silently falls back to a stale value.
// https://github.com/nuxt/nuxt/issues/36585

// Minimal DOM-free renderer (vue's own tests use the same technique)
const nodeOps = {
  createElement: (tag: string) => ({ tag }),
  patchProp: () => {},
  insert: () => {},
  remove: () => {},
  createText: (text: string) => ({ text }),
  createComment: (text: string) => ({ text }),
  setText: () => {},
  setElementText: () => {},
  parentNode: () => null,
  nextSibling: () => null,
  querySelector: () => null,
  setScopeId: () => {},
  cloneNode: (node: unknown) => node,
  insertStaticContent: () => [],
}
const { createApp } = createRenderer(nodeOps as any)

describe('injection keys with duplicated runtime copies', () => {
  it.each([
    ['PageRouteSymbol', PageRouteSymbol, 'PageRouteSymbol'],
    ['LayoutSymbol', LayoutSymbol, 'LayoutSymbol'],
    ['LayoutMetaSymbol', LayoutMetaSymbol, 'LayoutMetaSymbol'],
  ] as const)('%s is shared across copies, so inject() resolves the provided value', async (_name, appCopyKey, exportName) => {
    // Simulate a layer's second runtime copy by re-importing the module with a
    // distinct module id (separate module instance, like a duplicated dependency)
    // @ts-expect-error: the query suffix is intentional - it makes Vite evaluate a
    // second module instance, simulating a duplicated runtime copy
    const layerCopy = await import(`../src/app/components/injections.ts?duplicated-runtime-copy`) as typeof import('../src/app/components/injections')
    const layerCopyKey = layerCopy[exportName]

    const provided = { provided: true }
    const fallback = { fallback: true }
    let observed: unknown

    const Child = defineComponent({
      setup () {
        // what a layer's `useRoute()` does: inject with the layer copy's key,
        // falling back to a stale value when the provide is missed
        observed = inject(layerCopyKey as any, fallback)
        return () => h('child')
      },
    })
    const Parent = defineComponent({
      setup () {
        provide(appCopyKey as any, provided)
        return () => h(Child)
      },
    })

    createApp(Parent).mount(nodeOps.createElement('app') as any)

    expect(observed).toBe(provided)
  })
})
