import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { Component } from 'vue'
import { defineComponent, h } from 'vue'

describe('universal router', () => {
  it.each([
    ['/a/b?c=1&d=2#e', { path: '/a/b', query: { c: '1', d: '2' }, hash: '#e', href: '/a/b?c=1&d=2#e' }],
    ['/a#', { path: '/a', query: {}, hash: '', href: '/a#' }],
    ['/a/../b', { path: '/b', href: '/a/../b' }],
    ['/a b', { path: '/a%20b', href: '/a b' }],
    ['/café', { path: '/caf%C3%A9', href: '/café' }],
    ['#hash', { href: '#hash' }],
    ['https://example.com/a', { href: 'https://example.com/a' }],
    ['javascript:alert(1)', { href: null }],
    ['\u0001javascript:alert(1)', { href: null }],
    ['\u0001view-source:\u0001javascript:alert(1)', { href: null }],
  ])('should resolve %j', (to, expected) => {
    expect(useRouter().resolve(to)).toMatchObject(expected)
  })

  it('should resolve route objects', () => {
    expect(useRouter().resolve({ path: '/a', query: { b: '1' }, hash: '#c' })).toMatchObject({
      path: '/a',
      query: { b: '1' },
      hash: '#c',
      href: '/a?b=1#c',
    })
  })

  it('should provide a route', () => {
    expect(useRoute()).toMatchObject({
      fullPath: '/',
      hash: '',
      matched: expect.arrayContaining([]),
      meta: {},
      params: {},
      path: '/',
      query: {},
      redirectedFrom: undefined,
    })
  })

  it('applies the latest navigation when concurrent navigations race', async () => {
    const router = useRouter()

    let resolveSlowGuard: () => void
    let slowGuardEntered: (() => void) | undefined
    const entered = new Promise<void>((resolve) => { slowGuardEntered = resolve })
    const removeGuard = router.beforeEach(async (to) => {
      if (to.path === '/slow') {
        slowGuardEntered!()
        await new Promise<void>((resolve) => { resolveSlowGuard = resolve })
      }
    })

    const older = router.push('/slow')
    await entered
    const newer = router.push('/fast')
    await newer
    resolveSlowGuard!()
    await older
    removeGuard()

    expect(router.currentRoute.value.path).toBe('/fast')
  })

  it('navigates when navigateTo is called outside middleware while a navigation is pending', async () => {
    const router = useRouter()
    let release!: () => void
    const blocked = new Promise<void>((resolve) => { release = resolve })
    let enter!: () => void
    const entered = new Promise<void>((resolve) => { enter = resolve })
    const removeGuard = router.beforeResolve(async (to) => {
      if (to.path === '/roles') {
        enter()
        await blocked
      }
    })

    try {
      const older = navigateTo('/roles')
      await entered
      await navigateTo('/employment')
      release()
      await older
    } finally {
      removeGuard()
    }

    expect(router.currentRoute.value.path).toBe('/employment')
  })
})

const Probe = defineComponent({
  props: { to: { type: String, required: true }, custom: Boolean },
  setup (props) {
    const RouterLink = useNuxtApp().vueApp._context.components.RouterLink as Component
    return () => props.custom
      ? h(RouterLink, { to: props.to, custom: true }, { default: ({ href }: { href: string | null }) => h('a', { id: 'link', href }) })
      : h(RouterLink, { to: props.to, id: 'link' }, () => 'link')
  },
})

async function renderHref (to: string, custom: boolean) {
  const wrapper = await mountSuspended(Probe, { props: { to, custom } })
  return wrapper.find('#link').attributes('href')
}

describe('RouterLink without pages', () => {
  it.each([true, false])('should not render script-capable hrefs (custom: %s)', async (custom) => {
    expect(await renderHref('javascript:alert(1)', custom)).toBeUndefined()
    expect(await renderHref('\u0001javascript:alert(1)', custom)).toBeUndefined()
    expect(await renderHref('\u0001data:text/html,<script>alert(1)</script>', custom)).toBeUndefined()
    expect(await renderHref('\u0001view-source:javascript:alert(1)', custom)).toBeUndefined()
  })

  it.each([true, false])('should render safe hrefs (custom: %s)', async (custom) => {
    expect(await renderHref('/safe?a=1#b', custom)).toBe('/safe?a=1#b')
    expect(await renderHref('https://example.com', custom)).toBe('https://example.com')
  })
})
