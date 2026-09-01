import { describe, expect, it, vi } from 'vitest'
import { Fragment, Suspense, createSSRApp, defineComponent, h, nextTick, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { flushPromises } from '@vue/test-utils'

/**
 * Regression test for the `@vue/runtime-core` patch in `patches/`.
 *
 * Nuxt renders every page inside a suspensible `<Suspense>` nested in the root
 * suspense, so during initial hydration the root suspense always has pending
 * deps. `@vue/runtime-core` used to silently drop patches to a nested suspense
 * while its parent suspense was unresolved (vuejs/core#10055), which meant any
 * navigation before hydration finished (e.g. pressing the browser back button
 * on a slowly-hydrating page) updated the URL but left the old SSR DOM on
 * screen forever. The patch lets such updates through while the nested
 * suspense is still hydrating; `patchSuspense` then runs its dedicated
 * "toggled before hydration is finished" path, unmounting the stale SSR
 * branch and rendering the new content immediately.
 */

function createApp (opts: {
  gate: () => Promise<unknown>
  /** gates PageB's async setup, so a first swap can be left pending */
  targetGate?: () => Promise<unknown>
  onRootResolve?: () => void
  onNestedResolve?: () => void
  /**
   * when true, the root component tracks the route too, so the swap patches
   * through the root suspense's own same-root-type path instead of patching
   * the nested suspense directly - this exercises the `suspense.pendingBranch`
   * guard on the resolve call in `patchSuspense` (without it, the nested
   * resolve propagating to the root mid-patch makes the root resolve twice)
   */
  rootReadsRoute?: boolean
}) {
  const route = ref('a')

  const AsyncChild = defineComponent({
    name: 'AsyncChild',
    async setup () {
      await opts.gate()
      return () => h('div', 'async child ready')
    },
  })

  const TargetChild = defineComponent({
    name: 'TargetChild',
    async setup () {
      await opts.targetGate!()
      return () => h('div', 'target child ready')
    },
  })

  const PageA = defineComponent({
    name: 'PageA',
    setup: () => () => h('div', [h('h1', 'page a'), h(AsyncChild)]),
  })
  const PageB = defineComponent({
    name: 'PageB',
    setup: () => () => h('div', [h('h1', 'page b'), opts.targetGate ? h(TargetChild) : null]),
  })
  const PageC = defineComponent({
    name: 'PageC',
    setup: () => () => h('div', [h('h1', 'page c')]),
  })

  // mirrors `<NuxtPage>`: a suspensible Suspense with a keyed provider component
  const Provider = defineComponent({
    name: 'Provider',
    props: { vnode: { type: Object, required: true } },
    setup: props => () => h(props.vnode as Parameters<typeof h>[0]),
  })

  const Page = defineComponent({
    name: 'Page',
    setup: () => () => h(Suspense, {
      suspensible: true,
      onResolve: opts.onNestedResolve,
    }, {
      default: () => h(Provider, {
        key: route.value,
        vnode: route.value === 'a' ? h(PageA) : route.value === 'b' ? h(PageB) : h(PageC),
      }),
    }),
  })

  // mirrors `nuxt-root.vue`: the root Suspense wrapping the app
  const Root = defineComponent({
    name: 'Root',
    setup: () => () => h(Suspense, { onResolve: opts.onRootResolve }, {
      default: () => h(Page, opts.rootReadsRoute ? { 'data-route': route.value } : {}),
    }),
  })

  return { app: createSSRApp(Root), route }
}

describe('suspense hydration interrupt', () => {
  it('applies a branch swap in a nested suspensible suspense during hydration', async () => {
    // server render (the async child resolves immediately there)
    const ssr = createApp({ gate: () => Promise.resolve() })
    const html = await renderToString(ssr.app)
    expect(html).toContain('page a')

    const el = document.createElement('div')
    el.innerHTML = html
    document.body.appendChild(el)

    // client hydration, with the async child suspended until we release it
    let releaseGate: () => void
    const gate = new Promise<void>((resolve) => { releaseGate = resolve })
    let rootResolved = false
    let nestedResolved = false
    const client = createApp({
      gate: () => gate,
      onRootResolve: () => { rootResolved = true },
      onNestedResolve: () => { nestedResolved = true },
    })
    client.app.mount(el)

    await nextTick()
    expect(rootResolved).toBe(false)
    expect(el.innerHTML).toContain('page a')

    // swap the branch while hydration is still pending
    client.route.value = 'b'
    await flushPromises()

    // the new branch replaces the stale SSR DOM and both suspenses resolve
    expect(el.innerHTML).toContain('page b')
    expect(el.innerHTML).not.toContain('page a')
    expect(nestedResolved).toBe(true)
    expect(rootResolved).toBe(true)

    // resolving the abandoned async setup must not resurrect the old branch
    releaseGate!()
    await flushPromises()
    expect(el.innerHTML).toContain('page b')
    expect(el.innerHTML).not.toContain('page a')

    client.app.unmount()
    el.remove()
  })

  it('applies a branch swap that patches through the root suspense during hydration', async () => {
    const ssr = createApp({ gate: () => Promise.resolve(), rootReadsRoute: true })
    const html = await renderToString(ssr.app)
    expect(html).toContain('page a')

    const el = document.createElement('div')
    el.innerHTML = html
    document.body.appendChild(el)

    let releaseGate: () => void
    const gate = new Promise<void>((resolve) => { releaseGate = resolve })
    let rootResolveCount = 0
    let nestedResolved = false
    const client = createApp({
      gate: () => gate,
      rootReadsRoute: true,
      onRootResolve: () => { rootResolveCount++ },
      onNestedResolve: () => { nestedResolved = true },
    })
    // the double-resolve this guards against surfaces as an unhandled error
    // inside the scheduler flush, not as a failed DOM assertion
    const errorHandler = vi.fn()
    client.app.config.errorHandler = errorHandler
    client.app.mount(el)

    await nextTick()
    expect(rootResolveCount).toBe(0)
    expect(el.innerHTML).toContain('page a')

    client.route.value = 'b'
    await flushPromises()

    expect(el.innerHTML).toContain('page b')
    expect(el.innerHTML).not.toContain('page a')
    expect(nestedResolved).toBe(true)
    expect(rootResolveCount).toBe(1)

    releaseGate!()
    await flushPromises()
    expect(el.innerHTML).toContain('page b')
    expect(el.innerHTML).not.toContain('page a')
    expect(rootResolveCount).toBe(1)

    expect(errorHandler).not.toHaveBeenCalled()

    client.app.unmount()
    el.remove()
  })

  it('applies a second branch swap while the first swapped-to branch is still pending', async () => {
    // a boundary that was already toggled once during hydration has
    // `isHydrating` unset, so a second toggle relies on the
    // `!parentSuspense.isHydrating` part of the patched guard - without it the
    // second navigation is dropped and the abandoned async branch resurrects
    // once it resolves
    const resolved = () => Promise.resolve()
    const ssr = createApp({ gate: resolved, targetGate: resolved })
    const html = await renderToString(ssr.app)
    expect(html).toContain('page a')

    const el = document.createElement('div')
    el.innerHTML = html
    document.body.appendChild(el)

    let releaseGate: () => void
    let releaseTarget: () => void
    const gate = new Promise<void>((resolve) => { releaseGate = resolve })
    const targetGate = new Promise<void>((resolve) => { releaseTarget = resolve })
    let rootResolved = false
    const client = createApp({
      gate: () => gate,
      targetGate: () => targetGate,
      onRootResolve: () => { rootResolved = true },
    })
    client.app.mount(el)

    await nextTick()
    expect(rootResolved).toBe(false)
    expect(el.innerHTML).toContain('page a')

    // first swap while hydrating: PageB pends on its own async child, so the
    // SSR DOM of page a stays visible and the boundary stops hydrating
    client.route.value = 'b'
    await flushPromises()
    expect(el.innerHTML).toContain('page a')
    expect(rootResolved).toBe(false)

    // second swap while the root suspense is still hydrating
    client.route.value = 'c'
    await flushPromises()
    expect(el.innerHTML).toContain('page c')
    expect(el.innerHTML).not.toContain('page a')
    expect(el.innerHTML).not.toContain('page b')
    expect(rootResolved).toBe(true)

    // neither abandoned branch may resurrect once its gate resolves
    releaseTarget!()
    releaseGate!()
    await flushPromises()
    expect(el.innerHTML).toContain('page c')
    expect(el.innerHTML).not.toContain('page a')
    expect(el.innerHTML).not.toContain('page b')

    client.app.unmount()
    el.remove()
  })

  it('applies a fragment child insertion in a hydrating suspense', async () => {
    // a same-root-type update while hydrating used to patch against the detached
    // hiddenContainer with anchors from the live SSR DOM, throwing on insertBefore
    const createListApp = (gate: () => Promise<unknown>, onRootResolve?: () => void) => {
      const items = ref(['one', 'two'])
      const AsyncChild = defineComponent({
        name: 'AsyncChild',
        async setup () {
          await gate()
          return () => h('div', 'async child ready')
        },
      })
      const Page = defineComponent({
        name: 'Page',
        setup: () => () => h(Suspense, { suspensible: true }, {
          default: () => h(Fragment, [...items.value.map(i => h('div', { key: i }, i)), h(AsyncChild)]),
        }),
      })
      const Root = defineComponent({
        name: 'Root',
        setup: () => () => h(Suspense, { onResolve: onRootResolve }, { default: () => h(Page) }),
      })
      return { app: createSSRApp(Root), items }
    }

    const ssr = createListApp(() => Promise.resolve())
    const html = await renderToString(ssr.app)
    expect(html).toContain('two')

    const el = document.createElement('div')
    el.innerHTML = html
    document.body.appendChild(el)

    let releaseGate: () => void
    const gate = new Promise<void>((resolve) => { releaseGate = resolve })
    let rootResolved = false
    const client = createListApp(() => gate, () => { rootResolved = true })
    const errorHandler = vi.fn()
    client.app.config.errorHandler = errorHandler
    client.app.mount(el)

    await nextTick()
    expect(rootResolved).toBe(false)

    // insert a keyed child while the boundary is still hydrating
    client.items.value = ['one', 'two', 'three']
    await flushPromises()

    expect(errorHandler).not.toHaveBeenCalled()
    expect(el.innerHTML).toContain('three')
    // the in-place patch must not prematurely resolve the still-hydrating boundary
    expect(rootResolved).toBe(false)

    releaseGate!()
    await flushPromises()
    expect(rootResolved).toBe(true)
    expect(el.innerHTML).toContain('three')
    expect(el.innerHTML).toContain('async child ready')

    client.app.unmount()
    el.remove()
  })

  it('survives a prop update to an unresolved async slot root during hydration', async () => {
    // the async pre-render path replaces instance.vnode without carrying `el` over,
    // which used to skip the branch's teardown when it was toggled right after
    const createDirectApp = (gate: () => Promise<unknown>) => {
      const route = ref('a')
      const tick = ref(0)
      const PageA = defineComponent({
        name: 'PageA',
        props: { tick: { type: Number, default: 0 } },
        async setup () {
          await gate()
          return () => h('div', [h('h1', 'page a')])
        },
      })
      const PageB = defineComponent({
        name: 'PageB',
        setup: () => () => h('div', [h('h1', 'page b')]),
      })
      const Page = defineComponent({
        name: 'Page',
        setup: () => () => h(Suspense, { suspensible: true }, {
          default: () => route.value === 'a' ? h(PageA, { key: 'a', tick: tick.value }) : h(PageB, { key: 'b' }),
        }),
      })
      const Root = defineComponent({
        name: 'Root',
        setup: () => () => h(Suspense, {}, { default: () => h(Page) }),
      })
      return { app: createSSRApp(Root), route, tick }
    }

    const ssr = createDirectApp(() => Promise.resolve())
    const html = await renderToString(ssr.app)
    expect(html).toContain('page a')

    const el = document.createElement('div')
    el.innerHTML = html
    document.body.appendChild(el)

    let releaseGate: () => void
    const gate = new Promise<void>((resolve) => { releaseGate = resolve })
    const client = createDirectApp(() => gate)
    const errorHandler = vi.fn()
    client.app.config.errorHandler = errorHandler
    client.app.mount(el)

    await nextTick()
    expect(el.innerHTML).toContain('page a')

    // prop patch to the still-unresolved async root, then a branch toggle
    client.tick.value++
    await flushPromises()
    client.route.value = 'b'
    await flushPromises()

    expect(errorHandler).not.toHaveBeenCalled()
    expect(el.innerHTML).toContain('page b')
    expect(el.innerHTML).not.toContain('page a')

    // resolving the abandoned async setup must not resurrect the old branch
    releaseGate!()
    await flushPromises()
    expect(el.innerHTML).toContain('page b')
    expect(el.innerHTML).not.toContain('page a')

    client.app.unmount()
    el.remove()
  })
})
