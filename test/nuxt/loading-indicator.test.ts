/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { RouteLocationRaw } from 'vue-router'

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { NuxtLoadingIndicator, NuxtPage } from '#components'

describe('page loading indicator', () => {
  const router = useRouter()
  let resolve: undefined | (() => void)
  const nuxtApp = useNuxtApp()

  const { isLoading } = useLoadingIndicator({ duration: 1, throttle: 0, resetDelay: 0, hideDelay: 0 }) as any

  beforeEach(() => {
    resolve = undefined

    router.addRoute({
      name: 'page-load-hook',
      path: '/page-load-hook',
      component: defineComponent({
        name: '~/pages/page-load-hook.vue',
        setup: () => () => h('div', { id: 'page' }, [h('span', 'parent'), h(NuxtPage)]),
      }),
      children: [
        {
          name: 'page-load-hook-index',
          path: '',
          component: defineComponent({
            name: '~/pages/page-load-hook/index.vue',
            async setup () {
              await new Promise<void>((r) => { resolve = r })
              return () => h('div', 'index')
            },
          }),
        },
        {
          name: 'page-load-hook-slug',
          path: ':slug',
          component: defineComponent({
            name: '~/pages/page-load-hook/slug.vue',
            async setup () {
              const route = useRoute()
              await new Promise<void>((r) => { resolve = r })
              return () => h('div', [h('span', 'child'), route.fullPath])
            },
          }),
        },
      ],
    })
  })

  afterEach(() => {
    router.removeRoute('page-load-hook')
  })

  it('should hide nuxt page load indicator after navigating from nested page to other nested page', async () => {
    let startedLoading = 0
    let stoppedLoading = 0
    nuxtApp.hook('page:loading:start', () => {
      startedLoading++
    })
    nuxtApp.hook('page:loading:end', () => {
      stoppedLoading++
    })

    const route = useRoute()
    const waitForLoad = async () => {
      // ensure loading hasn't already finished
      await nextTick(() => new Promise(r => setTimeout(r, 0)))

      if (isLoading.value) {
        resolve!()
        await new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:loading:end', () => { resolve() }))
          .then(() => new Promise(r => setTimeout(r, 0)))
      }
    }

    const el = await mountSuspended({ setup: () => () => h('div', [h(NuxtLoadingIndicator), h(NuxtPage)]) })

    const getLoadingIndicator = () => el.getComponent('.nuxt-loading-indicator')
    const getPage = () => el.getComponent('#page')

    function expectLoaded () {
      expect(isLoading.value).toBe(false)
      expect(getLoadingIndicator().attributes().style).toContain('opacity: 0;')
    }
    function expectLoading () {
      expect(isLoading.value).toBe(true)
      expect(getLoadingIndicator().attributes().style).toContain('opacity: 1;')
    }
    async function onNavigation (path: string | RouteLocationRaw, onLoad?: () => void) {
      startedLoading = 0
      stoppedLoading = 0
      await navigateTo(path)
      expect(startedLoading).toBe(1)
      expect(stoppedLoading).toBe(0)

      expectLoading()
      onLoad?.()
      await waitForLoad()
      expect(startedLoading).toBe(1)
      expect(stoppedLoading).toBe(1)
      expectLoaded()
    }

    await flushPromises()
    expectLoaded()

    await onNavigation('/page-load-hook')
    expect(getPage().html()).toMatchInlineSnapshot(`
      "<div id="page"><span>parent</span>
        <div>index</div>
      </div>"
    `)

    await onNavigation('/page-load-hook/subpage')
    expect(getPage().html()).toMatchInlineSnapshot(`
      "<div id="page"><span>parent</span>
        <div><span>child</span>/page-load-hook/subpage</div>
      </div>"
    `)

    await onNavigation({ query: { someQuery: 'toto' } }, () => {
      expect(route.fullPath).toMatchInlineSnapshot(`"/page-load-hook/subpage?someQuery=toto"`)
    })

    await onNavigation('/page-load-hook/other-slug')
    expect(getPage().html()).toMatchInlineSnapshot(`
      "<div id="page"><span>parent</span>
        <div><span>child</span>/page-load-hook/other-slug</div>
      </div>"
    `)

    el.unmount()
  })
})
