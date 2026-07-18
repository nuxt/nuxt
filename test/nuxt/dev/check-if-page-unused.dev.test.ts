import { defineComponent, h, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { NuxtPage } from '#components'
import { useNuxtApp } from '#app/nuxt'
import { navigateTo, useRouter } from '#app/composables/router'

import plugin, { findUnrenderedNestedPage } from '../../../packages/nuxt/src/pages/runtime/plugins/check-if-page-unused'

describe('check-if-page-unused: nested page without `<NuxtPage />` (#25077)', () => {
  let router: ReturnType<typeof useRouter>
  let nuxtApp: ReturnType<typeof useNuxtApp>
  let warn: ReturnType<typeof vi.spyOn<Console, 'warn'>>
  let pluginInstalled = false

  const child = defineComponent({
    name: 'child-page',
    setup: () => () => h('div', 'child content'),
  })

  function parentComponent (withNuxtPage: boolean) {
    return defineComponent({
      name: 'parent-page',
      setup: () => () => h('div', ['parent content', withNuxtPage ? h(NuxtPage) : null]),
    })
  }

  async function mountAndNavigate (path: string) {
    const el = await mountSuspended({
      setup: () => () => h(NuxtPage),
    })
    if (!pluginInstalled) {
      pluginInstalled = true
      await nuxtApp.runWithContext(() => plugin.setup!(nuxtApp))
    }
    await navigateTo(path)
    await new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:finish', () => resolve()))
    await flushPromises()
    await nextTick()
    await flushPromises()
    return el
  }

  beforeEach(() => {
    router = useRouter()
    nuxtApp = useNuxtApp()
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(async () => {
    await navigateTo('/')
    await flushPromises()
    warn.mockRestore()
  })

  it('warns when a matched nested page is not rendered by its parent', async () => {
    router.addRoute({
      name: 'warn-parent',
      path: '/warn-parent',
      component: parentComponent(false),
      children: [{ name: 'warn-parent-child', path: 'child', component: child }],
    })

    const el = await mountAndNavigate('/warn-parent/child')

    expect(el.html()).toContain('parent content')
    expect(el.html()).not.toContain('child content')
    const messages = warn.mock.calls.map(args => args.join(' ')).filter(m => m.includes('NUXT_E4016'))
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain('/warn-parent/child')
    expect(messages[0]).toContain('`/warn-parent`')

    el.unmount()
    router.removeRoute('warn-parent')
  })

  it('warns only once for the same unrendered page', async () => {
    router.addRoute({
      name: 'dedup-parent',
      path: '/dedup-parent',
      component: parentComponent(false),
      children: [{ name: 'dedup-parent-child', path: 'child', component: child }],
    })

    const el = await mountAndNavigate('/dedup-parent/child')

    await navigateTo('/')
    await new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:finish', () => resolve()))
    await navigateTo('/dedup-parent/child')
    await new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:finish', () => resolve()))
    await flushPromises()
    await nextTick()
    await flushPromises()

    const messages = warn.mock.calls.map(args => args.join(' ')).filter(m => m.includes('NUXT_E4016'))
    expect(messages).toHaveLength(1)

    el.unmount()
    router.removeRoute('dedup-parent')
  })

  it('does not warn when the parent renders `<NuxtPage />`', async () => {
    router.addRoute({
      name: 'ok-parent',
      path: '/ok-parent',
      component: parentComponent(true),
      children: [{ name: 'ok-parent-child', path: 'child', component: child }],
    })

    const el = await mountAndNavigate('/ok-parent/child')

    expect(el.html()).toContain('child content')
    const messages = warn.mock.calls.map(args => args.join(' ')).filter(m => m.includes('NUXT_E4016'))
    expect(messages).toHaveLength(0)

    el.unmount()
    router.removeRoute('ok-parent')
  })

  it('does not warn for parent routes without a component', async () => {
    router.addRoute({
      name: 'transparent-parent',
      path: '/transparent-parent',
      children: [{ name: 'transparent-parent-child', path: 'child', component: child }],
    })

    const el = await mountAndNavigate('/transparent-parent/child')

    expect(el.html()).toContain('child content')
    const messages = warn.mock.calls.map(args => args.join(' ')).filter(m => m.includes('NUXT_E4016'))
    expect(messages).toHaveLength(0)

    el.unmount()
    router.removeRoute('transparent-parent')
  })

  it('findUnrenderedNestedPage identifies the first unrendered matched record', () => {
    const rendered = { components: { default: child }, instances: { default: {} }, path: '/a' }
    const unrendered = { components: { default: child }, instances: {}, path: '/a/b' }
    const transparent = { components: undefined, instances: {}, path: '/t' }

    expect(findUnrenderedNestedPage({ matched: [rendered, unrendered] } as any)).toMatchObject({
      parent: { path: '/a' },
      child: { path: '/a/b' },
    })
    expect(findUnrenderedNestedPage({ matched: [rendered, transparent, unrendered] } as any)).toMatchObject({
      parent: { path: '/a' },
      child: { path: '/a/b' },
    })
    expect(findUnrenderedNestedPage({ matched: [unrendered] } as any)).toBeUndefined()
    expect(findUnrenderedNestedPage({ matched: [rendered] } as any)).toBeUndefined()
  })
})
