/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { resolveComponent, resolveDynamicComponent } from 'vue'
import { NuxtLink } from '#components'

describe('useLink', () => {
  let router: ReturnType<typeof useRouter>

  beforeEach(() => {
    router = useRouter()
    if (!useNuxtApp().vueApp.component('NuxtLinkAlias')) {
      useNuxtApp().vueApp.component('NuxtLinkAlias', NuxtLink)
    }
    router.addRoute({
      name: 'use-link-target',
      path: '/use-link-target',
      component: defineComponent({ setup: () => () => h('div', 'target') }),
    })
  })

  afterEach(async () => {
    await navigateTo('/')
    router.removeRoute('use-link-target')
  })

  async function waitForRoute (fullPath: string) {
    await vi.waitFor(() => {
      if (useNuxtApp()._route.fullPath !== fullPath) {
        throw new Error(`route is ${useNuxtApp()._route.fullPath}`)
      }
    })
  }

  it('useLink navigate importing NuxtLink works', async () => {
    const link = (NuxtLink as any).useLink({ to: '/use-link-target' })
    expect(link.href.value).toBe('/use-link-target')
    await link.navigate()
    expect(useNuxtApp()._route.fullPath).toBe('/use-link-target')
  })

  it('useLink navigate using resolveComponent works', async () => {
    const el = await mountSuspended(defineComponent({
      setup () {
        const component = resolveComponent('NuxtLinkAlias') as any
        const link = component.useLink({ to: '/use-link-target' })
        return () => h('button', { id: 'button2', onClick: () => link.navigate() })
      },
    }))
    await el.get('#button2').trigger('click')
    await waitForRoute('/use-link-target')
    el.unmount()
  })

  it('useLink navigate using resolveDynamicComponent works', async () => {
    const el = await mountSuspended(defineComponent({
      setup () {
        const component = resolveDynamicComponent('NuxtLinkAlias') as any
        const link = component.useLink({ to: '/use-link-target' })
        return () => h('button', { id: 'button3', onClick: () => link.navigate() })
      },
    }))
    await el.get('#button3').trigger('click')
    await waitForRoute('/use-link-target')
    el.unmount()
  })
})
