/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { NuxtPage } from '#components'

vi.mock('#build/nuxt.config.mjs', async original => ({
  ...await original<Record<string, unknown>>(),
  appKeepalive: { include: ['keepalive-in-config', 'not-keepalive-in-nuxtpage'] },
}))

describe('keepalive', () => {
  let router: ReturnType<typeof useRouter>
  let logs: string[]

  const pageNames = ['keepalive-in-config', 'not-keepalive', 'keepalive-in-nuxtpage', 'keepalive-in-nuxtpage-2', 'not-keepalive-in-nuxtpage']

  beforeEach(() => {
    router = useRouter()
    logs = []

    router.addRoute({
      name: 'keepalive',
      path: '/keepalive',
      component: defineComponent({
        name: 'keepalive',
        setup: () => () => h('div', [
          h('h1', 'Keepalive Test'),
          h(NuxtPage, { keepalive: { include: ['keepalive-in-nuxtpage', 'keepalive-in-nuxtpage-2'], exclude: ['not-keepalive-in-nuxtpage'] } }),
        ]),
      }),
      children: pageNames.map(pageName => ({
        name: pageName,
        path: pageName,
        component: defineComponent({
          name: pageName,
          setup () {
            onMounted(() => logs.push(`${pageName}: onMounted`))
            onUnmounted(() => logs.push(`${pageName}: onUnmounted`))
            onActivated(() => logs.push(`${pageName}: onActivated`))
            onDeactivated(() => logs.push(`${pageName}: onDeactivated`))
            return () => h('div', pageName)
          },
        }),
      })),
    })
  })

  afterEach(() => {
    router.removeRoute('keepalive')
  })

  async function mountKeepalivePage () {
    const el = await mountSuspended({
      setup: () => () => h(NuxtPage),
    })
    await navigateTo('/keepalive')
    await flushPromises()
    logs = []
    return el
  }

  it('should not keepalive by default', async () => {
    const el = await mountKeepalivePage()

    await navigateTo('/keepalive/not-keepalive')
    await flushPromises()

    expect(logs).toEqual(['not-keepalive: onMounted'])
    el.unmount()
  })

  it('should not keepalive when included in app config but config in nuxt-page is not undefined', async () => {
    const el = await mountKeepalivePage()

    await navigateTo('/keepalive/keepalive-in-config')
    await flushPromises()

    expect(logs).toEqual(['keepalive-in-config: onMounted'])
    el.unmount()
  })

  it('should not keepalive when included in app config but exclueded in nuxt-page', async () => {
    const el = await mountKeepalivePage()

    await navigateTo('/keepalive/not-keepalive-in-nuxtpage')
    await flushPromises()

    expect(logs).toEqual(['not-keepalive-in-nuxtpage: onMounted'])
    el.unmount()
  })

  it('should keepalive when included in nuxt-page', async () => {
    const el = await mountKeepalivePage()

    await navigateTo('/keepalive/keepalive-in-nuxtpage')
    await flushPromises()

    expect(logs).toEqual(['keepalive-in-nuxtpage: onMounted', 'keepalive-in-nuxtpage: onActivated'])
    el.unmount()
  })

  it('should preserve keepalive config when navigate routes in nuxt-page', async () => {
    const el = await mountKeepalivePage()

    const slugs = [
      'keepalive-in-nuxtpage',
      'keepalive-in-nuxtpage-2',
      'keepalive-in-nuxtpage',
      'not-keepalive',
      'keepalive-in-nuxtpage-2',
    ]

    for (const slug of slugs) {
      await navigateTo(`/keepalive/${slug}`)
      await flushPromises()
    }

    expect(logs).toEqual([
      'keepalive-in-nuxtpage: onMounted',
      'keepalive-in-nuxtpage: onActivated',
      'keepalive-in-nuxtpage: onDeactivated',
      'keepalive-in-nuxtpage-2: onMounted',
      'keepalive-in-nuxtpage-2: onActivated',
      'keepalive-in-nuxtpage: onActivated',
      'keepalive-in-nuxtpage-2: onDeactivated',
      'keepalive-in-nuxtpage: onDeactivated',
      'not-keepalive: onMounted',
      'keepalive-in-nuxtpage-2: onActivated',
      'not-keepalive: onUnmounted',
    ])
    el.unmount()
  })
})
