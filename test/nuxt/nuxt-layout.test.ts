/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import { NuxtLayout, NuxtPage } from '#components'
import layouts from '#build/layouts.mjs'
import { useRoute } from '#app/composables/router'

describe('NuxtLayout', () => {
  const router = useRouter()
  let resolveDeferredPage: () => void

  let routeChanges = 0
  let renders: Record<string, number> = {}
  let setups: Record<string, number> = {}
  let el: VueWrapper

  const addedLayouts = ['layout-1', 'layout-2']
  const addedPages = ['no-layout', 'layout-1', 'layout-2', 'layout-2-deferred', 'deferred']

  beforeAll(async () => {
    for (const layout of addedLayouts) {
      layouts[layout] = defineComponent({
        setup (_, ctx) {
          const route = useRoute()
          watch(() => route.path, () => routeChanges++, { immediate: true })
          const fixed = route.path

          const key = `[layout] ${layout}`
          setups[key] ??= 0
          setups[key]++

          return () => {
            renders[key] ??= 0
            renders[key]++

            // console.log([
            //   `'${layout}' layout`,
            //   'Current route: ' + route.path + ` (initialised at: ${fixed})`,
            // ])

            return h('div', {}, [
              h('h1', `'${layout}' layout`),
              h('h2', 'Current route: ' + route.path + ` (initialised at: ${fixed})`),
              ...ctx.slots.default?.() || [],
            ])
          }
        },
      })
    }
    for (const page of addedPages) {
      router.addRoute({
        name: page,
        path: `/${page}`,
        meta: {
          // @ts-expect-error dynamically-added layout is not typed
          layout: ['layout-1', 'layout-2'].find(l => page.startsWith(l)),
        },
        component: defineComponent({
          name: 'layout-slug',
          async setup () {
            const route = useRoute()
            if (page.includes('deferred')) {
              await new Promise<void>((resolve) => {
                resolveDeferredPage = resolve
              })
            } else {
              await Promise.resolve()
            }

            const key = `[page] ${page}`
            setups[key] ??= 0
            setups[key]++

            return () => {
              renders[key] ??= 0
              renders[key]++

              // console.log([`${key} Current route: ` + route.path])
              return h('h3', 'Current route: ' + route.path)
            }
          },
        }),
      })
    }

    el = await mountSuspended({ setup: () => () => h(NuxtLayout, {}, { default: () => h(NuxtPage) }) })
  })

  beforeEach(() => {
    routeChanges = 0
    renders = {}
    setups = {}
  })

  afterAll(() => {
    for (const layout of addedLayouts) {
      delete layouts[layout]
    }
    for (const page of addedPages) {
      router.removeRoute(page)
    }
  })

  it('should have access to route when initially loading', async () => {
    expect.soft(el.html()).toMatchInlineSnapshot(`"<div>catchall</div>"`)

    // accesses layout of _new_ path when layout is loaded in a route change
    await navigateTo('/layout-1')
    await flushPromises()

    expect.soft(routeChanges).toBe(1)
    expect.soft(renders).toMatchInlineSnapshot(`
      {
        "[layout] layout-1": 1,
        "[page] layout-1": 1,
      }
    `)
    expect.soft(el.html()).toMatchInlineSnapshot(`
      "<div>
        <h1>'layout-1' layout</h1>
        <h2>Current route: /layout-1 (initialised at: /layout-1)</h2>
        <h3>Current route: /layout-1</h3>
      </div>"
    `)

    // does not rerender layout when switching pages
    await navigateTo('/layout-2-deferred')
    await flushPromises()

    // TODO: avoid secondary rerender
    expect.soft(routeChanges).toBe(3 /* should be 1 */)
    expect.soft(renders).toMatchInlineSnapshot(`
      {
        "[layout] layout-1": ${3 /* should be 1 */},
        "[layout] layout-2": 1,
        "[page] layout-1": 1,
      }
    `)
    expect.soft(el.html()).toMatchInlineSnapshot(`
      "<div>
        <h1>'layout-1' layout</h1>
        <h2>Current route: /${'layout-2-deferred' /* should be layout-1 */} (initialised at: /layout-1)</h2>
        <h3>Current route: /layout-1</h3>
      </div>"
    `)
    resolveDeferredPage()
    await flushPromises()
    expect.soft(renders).toMatchInlineSnapshot(`
      {
        "[layout] layout-1": 3,
        "[layout] layout-2": 1,
        "[page] layout-1": 1,
        "[page] layout-2-deferred": 1,
      }
    `)
    expect.soft(el.html()).toMatchInlineSnapshot(`
      "<div>
        <h1>'layout-2' layout</h1>
        <h2>Current route: /layout-2-deferred (initialised at: /layout-2-deferred)</h2>
        <h3>Current route: /layout-2-deferred</h3>
      </div>"
    `)
    expect.soft(routeChanges).toBe(3 /* should be 2 */)

    // route only updates in layout in the new suspense fork, not the old one
    await navigateTo('/layout-2')
    await nextTick()
    await flushPromises()
    expect.soft(el.html()).toMatchInlineSnapshot(`
      "<div>
        <h1>'layout-2' layout</h1>
        <h2>Current route: /layout-2 (initialised at: /layout-2-deferred)</h2>
        <h3>Current route: /layout-2</h3>
      </div>"
    `)
    expect.soft(renders).toMatchInlineSnapshot(`
      {
        "[layout] layout-1": 3,
        "[layout] layout-2": 3,
        "[page] layout-1": 1,
        "[page] layout-2": 2,
        "[page] layout-2-deferred": 1,
      }
    `)
    expect.soft(routeChanges).toBe(4)
  })

  it.todo('should not change layout before child page resolves', async () => {
    await navigateTo('/layout-1')
    await flushPromises()

    // does not update route used in layout until page switch has finished
    await navigateTo('/deferred')
    await flushPromises()
    expect.soft(el.html()).toMatchInlineSnapshot(`
      "<div>
        <h1>'layout-1' layout</h1>
        <h2>Current route: /layout-1 (initialised at: /layout-1)</h2>
        <h3>Current route: /layout-1</h3>
      </div>"
    `)

    resolveDeferredPage()
    await flushPromises()
    expect.soft(el.html()).toMatchInlineSnapshot(`"<h3>Current route: /deferred</h3>"`)
  })
})
