/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { NuxtLayout, NuxtPage } from '#components'

describe('NuxtPage with nested routes of different depths (#33766)', () => {
  let router: ReturnType<typeof useRouter>
  let nuxtApp: ReturnType<typeof useNuxtApp>
  let resolveA: undefined | (() => void)
  let resolveB: undefined | (() => void)

  const counts = {
    sectionA: { setup: 0, render: 0 },
    nestedA: { setup: 0, render: 0 },
    deepA: { setup: 0, render: 0 },
    sectionB: { setup: 0, render: 0 },
    nestedB: { setup: 0, render: 0 },
  }

  function resetCounts () {
    Object.values(counts).forEach((c) => { c.setup = 0; c.render = 0 })
  }

  beforeEach(() => {
    router = useRouter()
    nuxtApp = useNuxtApp()
    resolveA = undefined
    resolveB = undefined
    resetCounts()

    // Section A: 3 levels deep (/section-a/nested/deep)
    router.addRoute({
      name: 'section-a',
      path: '/section-a',
      component: defineComponent({
        name: 'section-a',
        setup () {
          counts.sectionA.setup++
          return () => {
            counts.sectionA.render++
            return h('div', { 'data-testid': 'section-a' }, [
              h('span', 'Section A'),
              h(NuxtPage),
            ])
          }
        },
      }),
      children: [
        {
          name: 'section-a-nested',
          path: 'nested',
          component: defineComponent({
            name: 'section-a-nested',
            setup () {
              counts.nestedA.setup++
              return () => {
                counts.nestedA.render++
                return h('div', { 'data-testid': 'nested-a' }, [
                  h('span', 'Nested A'),
                  h(NuxtPage),
                ])
              }
            },
          }),
          children: [
            {
              name: 'section-a-nested-deep',
              path: 'deep',
              component: defineComponent({
                name: 'section-a-nested-deep',
                async setup () {
                  counts.deepA.setup++
                  await new Promise<void>((r) => { resolveA = r })
                  return () => {
                    counts.deepA.render++
                    return h('div', { 'data-testid': 'deep-a' }, 'Deep A Content')
                  }
                },
              }),
            },
          ],
        },
      ],
    })

    // Section B: 2 levels deep (/section-b/nested)
    router.addRoute({
      name: 'section-b',
      path: '/section-b',
      component: defineComponent({
        name: 'section-b',
        setup () {
          counts.sectionB.setup++
          return () => {
            counts.sectionB.render++
            return h('div', { 'data-testid': 'section-b' }, [
              h('span', 'Section B'),
              h(NuxtPage),
            ])
          }
        },
      }),
      children: [
        {
          name: 'section-b-nested',
          path: 'nested',
          component: defineComponent({
            name: 'section-b-nested',
            async setup () {
              counts.nestedB.setup++
              await new Promise<void>((r) => { resolveB = r })
              return () => {
                counts.nestedB.render++
                return h('div', { 'data-testid': 'nested-b' }, 'Nested B Content')
              }
            },
          }),
        },
      ],
    })
  })

  afterEach(() => {
    router.removeRoute('section-a')
    router.removeRoute('section-b')
  })

  it('should have correct setup and render counts when navigating from deeper to shallower route', async () => {
    const el = await mountSuspended({
      setup () {
        return () => h(NuxtLayout, {}, { default: () => h(NuxtPage) })
      },
    })

    // Navigate to deep route (3 levels)
    await navigateTo('/section-a/nested/deep')
    resolveA!()
    await new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:finish', () => resolve()))
    await flushPromises()

    expect(el.html()).toContain('Section A')
    expect(el.html()).toContain('Nested A')
    expect(el.html()).toContain('Deep A Content')

    expect(counts.sectionA).toEqual({ setup: 1, render: 2 })
    expect(counts.nestedA).toEqual({ setup: 1, render: 1 })
    expect(counts.deepA).toEqual({ setup: 1, render: 1 })

    // Navigate to shallower route (2 levels)
    await navigateTo('/section-b/nested')
    resolveB!()
    await new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:finish', () => resolve()))
    await flushPromises()

    expect(el.html()).toContain('Section B')
    expect(el.html()).toContain('Nested B Content')
    expect(el.html()).not.toContain('Section A')
    expect(el.html()).not.toContain('Nested A')
    expect(el.html()).not.toContain('Deep A Content')

    expect(counts.sectionA).toEqual({ setup: 1, render: 2 })
    expect(counts.nestedA).toEqual({ setup: 1, render: 1 })
    expect(counts.deepA).toEqual({ setup: 1, render: 1 })
    expect(counts.sectionB).toEqual({ setup: 1, render: 2 })
    expect(counts.nestedB).toEqual({ setup: 1, render: 1 })

    el.unmount()
  })

  it('should have correct setup and render counts when navigating from shallower to deeper route', async () => {
    const el = await mountSuspended({
      setup () {
        return () => h(NuxtLayout, {}, { default: () => h(NuxtPage) })
      },
    })

    // Navigate to shallow route (2 levels)
    await navigateTo('/section-b/nested')
    resolveB!()
    await new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:finish', () => resolve()))
    await flushPromises()

    expect(el.html()).toContain('Section B')
    expect(el.html()).toContain('Nested B Content')

    expect(counts.sectionB).toEqual({ setup: 1, render: 2 })
    expect(counts.nestedB).toEqual({ setup: 1, render: 1 })

    // Navigate to deeper route (3 levels)
    await navigateTo('/section-a/nested/deep')
    resolveA!()
    await new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:finish', () => resolve()))
    await flushPromises()

    expect(el.html()).toContain('Section A')
    expect(el.html()).toContain('Nested A')
    expect(el.html()).toContain('Deep A Content')
    expect(el.html()).not.toContain('Section B')
    expect(el.html()).not.toContain('Nested B Content')

    expect(counts.sectionB).toEqual({ setup: 1, render: 2 })
    expect(counts.nestedB).toEqual({ setup: 1, render: 1 })
    expect(counts.sectionA).toEqual({ setup: 1, render: 2 })
    expect(counts.nestedA).toEqual({ setup: 1, render: 1 })
    expect(counts.deepA).toEqual({ setup: 1, render: 1 })

    el.unmount()
  })

  it('should have correct setup and render counts after multiple navigations', async () => {
    const el = await mountSuspended({
      setup () {
        return () => h(NuxtLayout, {}, { default: () => h(NuxtPage) })
      },
    })

    // Nav 1: Deep route (3 levels)
    await navigateTo('/section-a/nested/deep')
    resolveA!()
    await new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:finish', () => resolve()))
    await flushPromises()
    expect(el.html()).toContain('Deep A Content')

    expect(counts.sectionA).toEqual({ setup: 1, render: 2 })
    expect(counts.nestedA).toEqual({ setup: 1, render: 1 })
    expect(counts.deepA).toEqual({ setup: 1, render: 1 })
    expect(counts.sectionB).toEqual({ setup: 0, render: 0 })
    expect(counts.nestedB).toEqual({ setup: 0, render: 0 })

    // Nav 2: Shallow route (2 levels)
    await navigateTo('/section-b/nested')
    resolveB!()
    await new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:finish', () => resolve()))
    await flushPromises()
    expect(el.html()).toContain('Nested B Content')
    expect(el.html()).not.toContain('Deep A Content')

    expect(counts.sectionA).toEqual({ setup: 1, render: 2 })
    expect(counts.nestedA).toEqual({ setup: 1, render: 1 })
    expect(counts.deepA).toEqual({ setup: 1, render: 1 })
    expect(counts.sectionB).toEqual({ setup: 1, render: 2 })
    expect(counts.nestedB).toEqual({ setup: 1, render: 1 })

    // Nav 3: Back to deep route (3 levels) - components re-mount
    await navigateTo('/section-a/nested/deep')
    resolveA!()
    await new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:finish', () => resolve()))
    await flushPromises()
    expect(el.html()).toContain('Deep A Content')
    expect(el.html()).not.toContain('Nested B Content')

    expect(counts.sectionA).toEqual({ setup: 2, render: 4 })
    expect(counts.nestedA).toEqual({ setup: 2, render: 2 })
    expect(counts.deepA).toEqual({ setup: 2, render: 2 })
    expect(counts.sectionB).toEqual({ setup: 1, render: 2 })
    expect(counts.nestedB).toEqual({ setup: 1, render: 1 })

    // Nav 4: Back to shallow route (2 levels) - components re-mount
    await navigateTo('/section-b/nested')
    resolveB!()
    await new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:finish', () => resolve()))
    await flushPromises()
    expect(el.html()).toContain('Nested B Content')
    expect(el.html()).not.toContain('Deep A Content')

    expect(counts.sectionA).toEqual({ setup: 2, render: 4 })
    expect(counts.nestedA).toEqual({ setup: 2, render: 2 })
    expect(counts.deepA).toEqual({ setup: 2, render: 2 })
    expect(counts.sectionB).toEqual({ setup: 2, render: 4 })
    expect(counts.nestedB).toEqual({ setup: 2, render: 2 })

    el.unmount()
  })
})

describe('NuxtPage should re-render when navigating between deeply nested routes of same depth', () => {
  let router: ReturnType<typeof useRouter>
  let nuxtApp: ReturnType<typeof useNuxtApp>
  let resolveX: undefined | (() => void)
  let resolveY: undefined | (() => void)

  const counts = {
    treeX: { setup: 0, render: 0 },
    nestedX: { setup: 0, render: 0 },
    deepX: { setup: 0, render: 0 },
    treeY: { setup: 0, render: 0 },
    nestedY: { setup: 0, render: 0 },
    deepY: { setup: 0, render: 0 },
  }

  function resetCounts () {
    Object.values(counts).forEach((c) => { c.setup = 0; c.render = 0 })
  }

  beforeEach(() => {
    router = useRouter()
    nuxtApp = useNuxtApp()
    resolveX = undefined
    resolveY = undefined
    resetCounts()

    // Tree X: 3 levels deep (/tree-x/nested/deep)
    router.addRoute({
      name: 'tree-x',
      path: '/tree-x',
      component: defineComponent({
        name: 'tree-x',
        setup () {
          counts.treeX.setup++
          return () => {
            counts.treeX.render++
            return h('div', { 'data-testid': 'tree-x' }, [
              h('span', 'Tree X Root'),
              h(NuxtPage),
            ])
          }
        },
      }),
      children: [
        {
          name: 'tree-x-nested',
          path: 'nested',
          component: defineComponent({
            name: 'tree-x-nested',
            setup () {
              counts.nestedX.setup++
              return () => {
                counts.nestedX.render++
                return h('div', { 'data-testid': 'nested-x' }, [
                  h('span', 'Tree X Nested'),
                  h(NuxtPage),
                ])
              }
            },
          }),
          children: [
            {
              name: 'tree-x-nested-deep',
              path: 'deep',
              component: defineComponent({
                name: 'tree-x-nested-deep',
                async setup () {
                  counts.deepX.setup++
                  await new Promise<void>((r) => { resolveX = r })
                  return () => {
                    counts.deepX.render++
                    return h('div', { 'data-testid': 'deep-x' }, 'Tree X Deep Content')
                  }
                },
              }),
            },
          ],
        },
      ],
    })

    // Tree Y: 3 levels deep (/tree-y/nested/deep) - same depth as Tree X
    router.addRoute({
      name: 'tree-y',
      path: '/tree-y',
      component: defineComponent({
        name: 'tree-y',
        setup () {
          counts.treeY.setup++
          return () => {
            counts.treeY.render++
            return h('div', { 'data-testid': 'tree-y' }, [
              h('span', 'Tree Y Root'),
              h(NuxtPage),
            ])
          }
        },
      }),
      children: [
        {
          name: 'tree-y-nested',
          path: 'nested',
          component: defineComponent({
            name: 'tree-y-nested',
            setup () {
              counts.nestedY.setup++
              return () => {
                counts.nestedY.render++
                return h('div', { 'data-testid': 'nested-y' }, [
                  h('span', 'Tree Y Nested'),
                  h(NuxtPage),
                ])
              }
            },
          }),
          children: [
            {
              name: 'tree-y-nested-deep',
              path: 'deep',
              component: defineComponent({
                name: 'tree-y-nested-deep',
                async setup () {
                  counts.deepY.setup++
                  await new Promise<void>((r) => { resolveY = r })
                  return () => {
                    counts.deepY.render++
                    return h('div', { 'data-testid': 'deep-y' }, 'Tree Y Deep Content')
                  }
                },
              }),
            },
          ],
        },
      ],
    })
  })

  afterEach(() => {
    router.removeRoute('tree-x')
    router.removeRoute('tree-y')
  })

  it('should correctly re-render all components when navigating between two 3-level deep routes', async () => {
    const el = await mountSuspended({
      setup () {
        return () => h(NuxtLayout, {}, { default: () => h(NuxtPage) })
      },
    })

    // Navigate to first deep route (tree-x, 3 levels)
    await navigateTo('/tree-x/nested/deep')
    resolveX!()
    await new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:finish', () => resolve()))
    await flushPromises()

    expect(el.html()).toContain('Tree X Root')
    expect(el.html()).toContain('Tree X Nested')
    expect(el.html()).toContain('Tree X Deep Content')
    expect(el.html()).not.toContain('Tree Y')

    expect(counts.treeX).toEqual({ setup: 1, render: 2 })
    expect(counts.nestedX).toEqual({ setup: 1, render: 1 })
    expect(counts.deepX).toEqual({ setup: 1, render: 1 })
    expect(counts.treeY).toEqual({ setup: 0, render: 0 })
    expect(counts.nestedY).toEqual({ setup: 0, render: 0 })
    expect(counts.deepY).toEqual({ setup: 0, render: 0 })

    // Navigate to second deep route (tree-y, also 3 levels) - SAME DEPTH
    await navigateTo('/tree-y/nested/deep')
    resolveY!()
    await new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:finish', () => resolve()))
    await flushPromises()

    // Verify Tree Y content is now rendered (NOT stale Tree X content)
    expect(el.html()).toContain('Tree Y Root')
    expect(el.html()).toContain('Tree Y Nested')
    expect(el.html()).toContain('Tree Y Deep Content')
    expect(el.html()).not.toContain('Tree X Root')
    expect(el.html()).not.toContain('Tree X Nested')
    expect(el.html()).not.toContain('Tree X Deep Content')

    expect(counts.treeX).toEqual({ setup: 1, render: 2 })
    expect(counts.nestedX).toEqual({ setup: 1, render: 1 })
    expect(counts.deepX).toEqual({ setup: 1, render: 1 })
    expect(counts.treeY).toEqual({ setup: 1, render: 2 })
    expect(counts.nestedY).toEqual({ setup: 1, render: 1 })
    expect(counts.deepY).toEqual({ setup: 1, render: 1 })

    el.unmount()
  })

  it('should correctly re-render when navigating back and forth between same-depth routes', async () => {
    const el = await mountSuspended({
      setup () {
        return () => h(NuxtLayout, {}, { default: () => h(NuxtPage) })
      },
    })

    // Nav 1: Tree X
    await navigateTo('/tree-x/nested/deep')
    resolveX!()
    await new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:finish', () => resolve()))
    await flushPromises()
    expect(el.html()).toContain('Tree X Deep Content')
    expect(el.html()).not.toContain('Tree Y')

    // Nav 2: Tree Y (same depth)
    await navigateTo('/tree-y/nested/deep')
    resolveY!()
    await new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:finish', () => resolve()))
    await flushPromises()
    expect(el.html()).toContain('Tree Y Deep Content')
    expect(el.html()).not.toContain('Tree X')

    // Nav 3: Back to Tree X
    await navigateTo('/tree-x/nested/deep')
    resolveX!()
    await new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:finish', () => resolve()))
    await flushPromises()
    expect(el.html()).toContain('Tree X Deep Content')
    expect(el.html()).not.toContain('Tree Y')

    // Nav 4: Back to Tree Y
    await navigateTo('/tree-y/nested/deep')
    resolveY!()
    await new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:finish', () => resolve()))
    await flushPromises()
    expect(el.html()).toContain('Tree Y Deep Content')
    expect(el.html()).not.toContain('Tree X')

    expect(counts.treeX).toEqual({ setup: 2, render: 4 })
    expect(counts.nestedX).toEqual({ setup: 2, render: 2 })
    expect(counts.deepX).toEqual({ setup: 2, render: 2 })
    expect(counts.treeY).toEqual({ setup: 2, render: 4 })
    expect(counts.nestedY).toEqual({ setup: 2, render: 2 })
    expect(counts.deepY).toEqual({ setup: 2, render: 2 })

    el.unmount()
  })
})

describe('NuxtPage render counts with synchronous components', () => {
  let router: ReturnType<typeof useRouter>

  const counts = {
    parent: { setup: 0, render: 0 },
    child: { setup: 0, render: 0 },
    grandchild: { setup: 0, render: 0 },
  }

  function resetCounts () {
    Object.values(counts).forEach((c) => { c.setup = 0; c.render = 0 })
  }

  beforeEach(() => {
    router = useRouter()
    resetCounts()

    router.addRoute({
      name: 'sync-parent',
      path: '/sync-parent',
      component: defineComponent({
        name: 'sync-parent',
        setup () {
          counts.parent.setup++
          return () => {
            counts.parent.render++
            return h('div', { id: 'sync-parent' }, [
              h('span', 'Sync Parent'),
              h(NuxtPage),
            ])
          }
        },
      }),
      children: [
        {
          name: 'sync-child',
          path: 'child',
          component: defineComponent({
            name: 'sync-child',
            setup () {
              counts.child.setup++
              return () => {
                counts.child.render++
                return h('div', { id: 'sync-child' }, [
                  h('span', 'Sync Child'),
                  h(NuxtPage),
                ])
              }
            },
          }),
          children: [
            {
              name: 'sync-grandchild',
              path: 'grandchild',
              component: defineComponent({
                name: 'sync-grandchild',
                setup () {
                  counts.grandchild.setup++
                  return () => {
                    counts.grandchild.render++
                    return h('div', { id: 'sync-grandchild' }, 'Sync Grandchild Content')
                  }
                },
              }),
            },
          ],
        },
      ],
    })
  })

  afterEach(() => {
    router.removeRoute('sync-parent')
  })

  it('should have expected render counts for synchronous nested components', async () => {
    const el = await mountSuspended({
      setup () {
        return () => h(NuxtLayout, {}, { default: () => h(NuxtPage) })
      },
    })

    await navigateTo('/sync-parent/child/grandchild')
    await flushPromises()

    expect(el.html()).toContain('Sync Parent')
    expect(el.html()).toContain('Sync Child')
    expect(el.html()).toContain('Sync Grandchild Content')

    // Parent renders twice, child and grandchild render once
    expect(counts.parent).toEqual({ setup: 1, render: 2 })
    expect(counts.child).toEqual({ setup: 1, render: 1 })
    expect(counts.grandchild).toEqual({ setup: 1, render: 1 })

    el.unmount()
  })

  it('should have expected render counts when navigating deeper within same route tree', async () => {
    const el = await mountSuspended({
      setup () {
        return () => h(NuxtLayout, {}, { default: () => h(NuxtPage) })
      },
    })

    // Navigate to parent level
    resetCounts()
    await navigateTo('/sync-parent')
    await flushPromises()

    expect(counts.parent).toEqual({ setup: 1, render: 2 })
    expect(counts.child).toEqual({ setup: 0, render: 0 })

    // Navigate deeper to child level - parent stays mounted
    resetCounts()
    await navigateTo('/sync-parent/child')
    await flushPromises()

    expect(counts.parent).toEqual({ setup: 0, render: 2 })
    expect(counts.child).toEqual({ setup: 1, render: 1 })

    // Navigate deeper to grandchild level - parent and child stay mounted
    resetCounts()
    await navigateTo('/sync-parent/child/grandchild')
    await flushPromises()

    expect(counts.parent).toEqual({ setup: 0, render: 2 })
    expect(counts.child).toEqual({ setup: 0, render: 1 })
    expect(counts.grandchild).toEqual({ setup: 1, render: 1 })

    el.unmount()
  })
})

describe('NuxtPage should work with keepalive options', () => {
  let visits = 0
  let router: ReturnType<typeof useRouter>
  beforeEach(() => {
    router = useRouter()
    visits = 0
    router.addRoute({
      name: 'home',
      path: '/home',
      component: defineComponent({
        name: 'home',
        setup () {
          visits++
          return () => h('div', 'home')
        },
      }),
    })
  })
  afterEach(() => {
    router.removeRoute('home')
  })

  it('should reload setup every time a page is visited, without keepalive', async () => {
    const el = await mountSuspended({
      setup () {
        return () => h(NuxtLayout, {}, { default: () => h(NuxtPage) })
      },
    })
    await navigateTo('/home')
    await navigateTo('/')
    await navigateTo('/home')
    expect(visits).toBe(2)
    el.unmount()
  })

  it('should not remount a page when keepalive is enabled', async () => {
    const el = await mountSuspended({
      setup () {
        return () => h(NuxtLayout, {}, { default: () => h(NuxtPage, { keepalive: true }) })
      },
    })
    await navigateTo('/home')
    await navigateTo('/')
    await navigateTo('/home')
    expect(visits).toBe(1)
    el.unmount()
  })

  it('should not remount a page when keepalive is granularly enabled (with include)', async () => {
    const el = await mountSuspended({
      setup () {
        return () => h(NuxtLayout, {}, { default: () => h(NuxtPage, { keepalive: { include: ['home'] } }) })
      },
    })
    await navigateTo('/home')
    await navigateTo('/')
    await navigateTo('/home')
    expect(visits).toBe(1)
    el.unmount()
  })

  it('should not remount a page when keepalive is granularly enabled (with exclude)', async () => {
    const el = await mountSuspended({
      setup () {
        return () => h(NuxtLayout, {}, { default: () => h(NuxtPage, { keepalive: { exclude: ['catchall'] } }) })
      },
    })
    await navigateTo('/home')
    await navigateTo('/')
    await navigateTo('/home')
    expect(visits).toBe(1)
    el.unmount()
  })

  it('should not remount a page when keepalive options are modified', async () => {
    const pages = ref('home')
    const el = await mountSuspended({
      setup () {
        return () => h(NuxtLayout, {}, { default: () => h(NuxtPage, { keepalive: { include: pages.value } }) })
      },
    })
    await navigateTo('/home')
    await navigateTo('/')
    await navigateTo('/home')
    pages.value = 'home,catchall'
    await navigateTo('/')
    await navigateTo('/home')
    expect(visits).toBe(1)
    el.unmount()
  })
})
