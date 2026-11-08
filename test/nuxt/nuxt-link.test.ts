/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { Fragment, createElementBlock, createElementVNode, createSlots, createTextVNode, openBlock, renderList, resolveComponent, resolveDynamicComponent, shallowReactive, toDisplayString, withCtx } from 'vue'
import type { Component } from 'vue'
import { PatchFlags } from '@vue/shared'
import { NuxtLink } from '#components'
import { createNuxtLinkBlock, createNuxtLinkVNode } from '#app/components/nuxt-link'
import { PageRouteSymbol } from '#app/components/injections'

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

  it('useLink resolves a relative path against the current route', async () => {
    router.addRoute({
      name: 'use-link-sibling',
      path: '/use-link-nested/sibling',
      component: defineComponent({ setup: () => () => h('div', 'sibling') }),
    })
    router.addRoute({
      name: 'use-link-nested',
      path: '/use-link-nested/child',
      component: defineComponent({ setup: () => () => h('div', 'child') }),
    })

    const el = await mountSuspended(defineComponent({
      setup: () => () => h(NuxtLink, { to: 'sibling', id: 'link' }, () => 'sibling'),
    }))
    await navigateTo('/use-link-nested/child')
    await waitForRoute('/use-link-nested/child')

    const href = (NuxtLink as any).useLink({ to: 'sibling' }).href.value
    expect(href).toBe('/use-link-nested/sibling')
    expect(href).toBe(router.resolve('sibling').href)
    expect(el.get('#link').attributes('href')).toBe(href)

    el.unmount()
    router.removeRoute('use-link-nested')
    router.removeRoute('use-link-sibling')
  })

  it('useLink only resolves against the router for relative paths', () => {
    const resolve = vi.spyOn(router, 'resolve')
    try {
      expect((NuxtLink as any).useLink({ to: '/use-link-target' }).href.value).toBe('/use-link-target')
      expect(resolve).not.toHaveBeenCalled()

      expect((NuxtLink as any).useLink({ to: 'use-link-target' }).href.value).toBe('/use-link-target')
      expect(resolve).toHaveBeenCalled()
    } finally {
      resolve.mockRestore()
    }
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

describe('template links without a component instance', () => {
  let router: ReturnType<typeof useRouter>

  const mount = (component: Component) => mountSuspended(component, {
    global: { components: { RouterLink: useNuxtApp().vueApp.component('RouterLink')! } },
  })

  beforeEach(() => {
    router = useRouter()
    router.addRoute({
      name: 'inline-link-param',
      path: '/inline-link-param/:id',
      component: defineComponent({ setup: () => () => h('div', 'param') }),
    })
  })

  afterEach(async () => {
    await navigateTo('/')
    router.removeRoute('inline-link-param')
  })

  function textSlot (text: () => string) {
    return withCtx(() => [createTextVNode(toDisplayString(text()), PatchFlags.TEXT)])
  }

  it('creates an anchor in the parent render', async () => {
    const el = await mount(defineComponent({
      render: () => (openBlock(), createElementBlock('div', null, [
        createNuxtLinkVNode(NuxtLink, { to: '/inline-link-param/1', class: 'custom' }, { default: textSlot(() => 'one'), _: 1 }, PatchFlags.PROPS, ['to']),
      ])),
    }))
    const anchor = el.get('a')
    expect(anchor.attributes('href')).toBe('/inline-link-param/1')
    expect(anchor.classes()).toEqual(['custom'])
    expect(el.findComponent(NuxtLink).exists()).toBe(false)

    await anchor.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/inline-link-param/1'))
    await vi.waitFor(() => expect(el.get('a').classes()).toEqual(['router-link-active', 'router-link-exact-active', 'custom']))
    expect(el.get('a').attributes('aria-current')).toBe('page')

    await navigateTo('/')
    await vi.waitFor(() => expect(el.get('a').classes()).toEqual(['custom']))
    expect(el.get('a').attributes('aria-current')).toBeUndefined()
    el.unmount()
  })

  it('passes attributes and listeners through to the anchor', async () => {
    const onClick = vi.fn()
    const el = await mount(defineComponent({
      render: () => (openBlock(), createElementBlock('div', null, [
        createNuxtLinkVNode(NuxtLink, { 'to': '/inline-link-param/1', 'id': 'link', 'aria-label': 'One', onClick }, { default: textSlot(() => 'one'), _: 1 }, PatchFlags.PROPS, ['to']),
      ])),
    }))
    const anchor = el.get('a')
    expect(el.findComponent(NuxtLink).exists()).toBe(false)
    expect(anchor.attributes('id')).toBe('link')
    expect(anchor.attributes('aria-label')).toBe('One')

    await anchor.trigger('click')
    expect(onClick).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/inline-link-param/1'))
    el.unmount()
  })

  it('follows the active state of the injected page route', async () => {
    const pageRoute = shallowReactive({ ...router.resolve('/') })
    const Links = defineComponent({
      render: () => (openBlock(), createElementBlock('div', null, [
        createNuxtLinkVNode(NuxtLink, { to: '/inline-link-param/1' }, { default: textSlot(() => 'one'), _: 1 }),
      ])),
    })
    const el = await mount(defineComponent({
      setup () {
        provide(PageRouteSymbol, pageRoute)
        return () => h(Links)
      },
    }))
    expect(el.findComponent(NuxtLink).exists()).toBe(false)

    await navigateTo('/inline-link-param/1')
    await nextTick()
    expect(el.get('a').classes()).toEqual([])

    Object.assign(pageRoute, router.currentRoute.value)
    await nextTick()
    expect(el.get('a').classes()).toEqual(['router-link-active', 'router-link-exact-active'])
    expect(el.get('a').attributes('aria-current')).toBe('page')
    el.unmount()
  })

  it('prefetches the destination once it becomes visible', async () => {
    const nuxtApp = useNuxtApp() as ReturnType<typeof useNuxtApp> & { _inlineLinks?: unknown }
    const { _observer, _inlineLinks } = nuxtApp
    const OriginalIntersectionObserver = window.IntersectionObserver
    const observed = new Set<Element>()
    let intersect: (el: Element) => void = () => {}
    window.IntersectionObserver = class {
      constructor (callback: IntersectionObserverCallback) {
        intersect = el => callback([{ target: el, isIntersecting: true } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver)
      }

      observe = (el: Element) => { observed.add(el) }
      unobserve = (el: Element) => { observed.delete(el) }
      disconnect = () => { observed.clear() }
    } as any
    nuxtApp._observer = undefined
    nuxtApp._inlineLinks = undefined
    const prefetched: string[] = []
    const removeHook = nuxtApp.hooks.hook('link:prefetch', (path) => { prefetched.push(path) })
    const loaded = vi.fn(() => defineComponent({ setup: () => () => h('div', 'lazy') }))
    router.addRoute({ name: 'inline-link-lazy', path: '/inline-link-lazy', component: () => Promise.resolve(loaded()) })

    try {
      const el = await mount(defineComponent({
        render: () => (openBlock(), createElementBlock('div', null, [
          createNuxtLinkVNode(NuxtLink, { to: '/inline-link-lazy' }, { default: textSlot(() => 'lazy'), _: 1 }),
        ])),
      }))
      const anchor = el.get('a').element
      expect(el.findComponent(NuxtLink).exists()).toBe(false)
      await vi.waitFor(() => expect(observed.has(anchor)).toBe(true))
      expect(prefetched).toEqual([])
      expect(loaded).not.toHaveBeenCalled()

      intersect(anchor)
      await vi.waitFor(() => expect(prefetched).toEqual(['/inline-link-lazy']))
      await vi.waitFor(() => expect(loaded).toHaveBeenCalledOnce())
      expect(observed.has(anchor)).toBe(false)
      expect(router.currentRoute.value.fullPath).toBe('/')
      el.unmount()
    } finally {
      removeHook()
      router.removeRoute('inline-link-lazy')
      nuxtApp._observer = _observer
      nuxtApp._inlineLinks = _inlineLinks
      window.IntersectionObserver = OriginalIntersectionObserver
    }
  })

  it('leaves modified clicks to the browser', async () => {
    const el = await mount(defineComponent({
      render: () => (openBlock(), createElementBlock('div', null, [
        createNuxtLinkVNode(NuxtLink, { to: '/inline-link-param/1' }, { default: textSlot(() => 'one'), _: 1 }),
      ])),
    }))
    expect(el.findComponent(NuxtLink).exists()).toBe(false)
    const push = vi.spyOn(router, 'push')
    try {
      const event = new MouseEvent('click', { ctrlKey: true, cancelable: true })
      el.get('a').element.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
      expect(push).not.toHaveBeenCalled()
    } finally {
      push.mockRestore()
      el.unmount()
    }
  })

  it('patches the anchor and its slot content when the parent re-renders', async () => {
    const id = ref('1')
    const el = await mount(defineComponent({
      render: () => (openBlock(), createElementBlock('div', null, [
        createNuxtLinkVNode(NuxtLink, { to: `/inline-link-param/${id.value}` }, {
          default: withCtx((link: { isActive: boolean }) => [createTextVNode(toDisplayString(`${id.value}:${link.isActive}`), PatchFlags.TEXT)]),
          _: 1,
        }, PatchFlags.PROPS, ['to']),
      ])),
    }))
    expect(el.findComponent(NuxtLink).exists()).toBe(false)
    expect(el.get('a').text()).toBe('1:false')

    id.value = '2'
    await nextTick()
    expect(el.get('a').attributes('href')).toBe('/inline-link-param/2')
    expect(el.get('a').text()).toBe('2:false')

    await navigateTo('/inline-link-param/2')
    await vi.waitFor(() => expect(el.get('a').text()).toBe('2:true'))
    el.unmount()
  })

  it('keys anchor blocks in a list', async () => {
    const ids = ref(['1', '2', '3'])
    const el = await mount(defineComponent({
      render: () => (openBlock(), createElementBlock('div', null, [
        (openBlock(true), createElementBlock(Fragment, null, renderList(ids.value, id => (openBlock(), createNuxtLinkBlock(NuxtLink, { key: id, to: `/inline-link-param/${id}` }, { default: textSlot(() => id), _: 2 }, PatchFlags.PROPS | PatchFlags.DYNAMIC_SLOTS, ['to']))), PatchFlags.KEYED_FRAGMENT)),
      ])),
    }))
    expect(el.findComponent(NuxtLink).exists()).toBe(false)
    const anchors = el.findAll('a').map(a => a.element)
    expect(anchors.map(a => a.textContent)).toEqual(['1', '2', '3'])

    ids.value = ['3', '1']
    await nextTick()
    const next = el.findAll('a').map(a => a.element)
    expect(next.map(a => a.textContent)).toEqual(['3', '1'])
    expect(next[0]).toBe(anchors[2])
    expect(next[1]).toBe(anchors[0])
    el.unmount()
  })

  it.each([
    ['an object location', { to: { path: '/inline-link-param/1' } }],
    ['an external link', { to: 'https://nuxt.com' }],
    ['a target', { to: '/inline-link-param/1', target: '_blank' }],
    ['custom', { to: '/inline-link-param/1', custom: '' }],
    ['a template ref', { to: '/inline-link-param/1', ref: 'link' }],
    ['a view transition', { 'to': '/inline-link-param/1', 'view-transition': '' }],
    ['interaction prefetching', { to: '/inline-link-param/1', prefetchOn: 'interaction' }],
    ['`v-html`', { to: '/inline-link-param/1', innerHTML: '<b>link</b>' }],
  ])('renders the component for %s', async (_, props) => {
    const el = await mount(defineComponent({
      render: () => (openBlock(), createElementBlock('div', null, [
        createNuxtLinkVNode(NuxtLink, props, { default: textSlot(() => 'link'), _: 1 }, PatchFlags.FULL_PROPS),
      ])),
    }))
    expect(el.findComponent(NuxtLink).exists()).toBe(true)
    el.unmount()
  })

  it('updates dynamic slot content', async () => {
    const name = ref('default')
    const el = await mount(defineComponent({
      render: () => (openBlock(), createElementBlock('div', null, [
        createNuxtLinkVNode(NuxtLink, { to: '/inline-link-param/1' }, { [name.value]: withCtx(() => [createElementVNode('b', null, 'link')]), _: 2 }, PatchFlags.DYNAMIC_SLOTS),
      ])),
    }))
    expect(el.findComponent(NuxtLink).exists()).toBe(false)
    expect(el.get('a').text()).toBe('link')

    name.value = 'other'
    await nextTick()
    expect(el.get('a').text()).toBe('')

    name.value = 'default'
    await nextTick()
    expect(el.get('a').text()).toBe('link')
    el.unmount()
  })

  it('updates conditional slot content', async () => {
    const first = ref(true)
    const el = await mount(defineComponent({
      render: () => (openBlock(), createElementBlock('div', null, [
        createNuxtLinkVNode(NuxtLink, { to: '/inline-link-param/1' }, createSlots({ _: 2 }, [
          first.value
            ? { name: 'default', fn: withCtx(() => [createElementVNode('b', null, 'first')]), key: '0' }
            : { name: 'default', fn: withCtx(() => [createTextVNode('second')]), key: '1' },
        ]), PatchFlags.DYNAMIC_SLOTS),
      ])),
    }))
    expect(el.get('a').html()).toContain('<b>first</b>')

    first.value = false
    await nextTick()
    expect(el.get('a').text()).toBe('second')
    el.unmount()
  })
})
