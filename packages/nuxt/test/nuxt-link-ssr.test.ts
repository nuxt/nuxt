import { describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import type { ComponentInternalInstance, VNode } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'

const nuxtApp = {
  hooks: { callHook: () => Promise.resolve() },
  ssrContext: {},
  $config: { app: { baseURL: '/' }, public: {} },
  $router: undefined as Router | undefined,
}

vi.mock('#app/nuxt', () => ({
  useRuntimeConfig: () => nuxtApp.$config,
  useNuxtApp: () => nuxtApp,
  tryUseNuxtApp: () => nuxtApp,
}))

const { defineNuxtLink } = await import('#app/components/nuxt-link')
const { ssrRenderNuxtLink } = await import('#app/components/nuxt-link-ssr-render')

const Stub = defineComponent({ setup: () => () => h('div') })
const routes = [
  { path: '/', component: Stub },
  {
    path: '/parent',
    component: Stub,
    children: [
      { path: '', component: Stub },
      { path: 'child/:id?', component: Stub },
    ],
  },
  { path: '/named/:id', name: 'named', component: Stub, alias: '/aliased/:id' },
  { path: '/query', component: Stub },
]

interface Case {
  name: string
  options?: Record<string, unknown>
  props?: Record<string, unknown>
  attrs?: Record<string, unknown>
  at?: string
  slot?: (props: any) => VNode | VNode[] | string
  routerOptions?: Record<string, unknown>
}

async function renderLink (testCase: Case, server: boolean, buffer = false) {
  vi.stubGlobal('__TEST_SERVER__', server)

  const router = createRouter({ history: createMemoryHistory(), routes, ...testCase.routerOptions })
  nuxtApp.$router = router
  await router.push(testCase.at ?? '/')
  await router.isReady()

  const Link = defineNuxtLink({ componentName: 'NuxtLink', ...testCase.options })
  const props = { ...testCase.props, ...testCase.attrs }
  const slot = testCase.slot ?? (() => 'text')
  const app = createApp(buffer
    ? defineComponent({
        ssrRender: (_ctx: unknown, push: (item: unknown) => void, parent: ComponentInternalInstance) => {
          push('<div>')
          push(ssrRenderNuxtLink(Link as any, props, { default: testCase.slot ?? ((_: unknown, push?: (item: string) => void) => push ? push('text') : 'text') } as any, parent))
          push('</div>')
        },
      })
    : defineComponent({
        setup: () => () => h('div', [h(Link as any, props, slot)]),
      }))
  app.use(router)

  return renderToString(app)
}

// Server-rendered internal links bypass `<RouterLink>`, so the two paths must produce identical
// markup or the client would fail to hydrate the anchor.
const cases: Case[] = [
  { name: 'renders an inactive link' },
  { name: 'renders an active parent link', props: { to: '/parent' }, at: '/parent/child/1' },
  { name: 'renders an exact active link', props: { to: '/parent' }, at: '/parent' },
  { name: 'renders an active leaf link', props: { to: '/parent/child/1' }, at: '/parent/child/1' },
  { name: 'distinguishes links differing only by params', props: { to: '/parent/child/1' }, at: '/parent/child/2' },
  { name: 'resolves an aliased route', props: { to: '/aliased/1' }, at: '/named/1' },
  { name: 'resolves a named route object', props: { to: { name: 'named', params: { id: '2' } } } },
  { name: 'resolves a route object with query and hash', props: { to: { path: '/query', query: { a: 'b c' }, hash: '#h' } } },
  { name: 'encodes an unencoded path', props: { to: '/parent/child/a b' } },
  { name: 'renders an empty `to`', props: {} },
  { name: 'applies `rel`', props: { to: '/parent', rel: 'nofollow' } },
  { name: 'merges fallthrough attributes', props: { to: '/parent' }, attrs: { 'class': 'user', 'id': 'x', 'data-foo': '1' }, at: '/parent' },
  { name: 'applies the `activeClass` prop', props: { to: '/parent', activeClass: 'on' }, at: '/parent' },
  { name: 'applies the `exactActiveClass` prop', props: { to: '/parent', exactActiveClass: 'exact-on' }, at: '/parent' },
  { name: 'applies `activeClass` from options', options: { activeClass: 'opt-on' }, props: { to: '/parent' }, at: '/parent' },
  { name: 'applies active classes from router options', routerOptions: { linkActiveClass: 'r-on', linkExactActiveClass: 'r-exact-on' }, props: { to: '/parent' }, at: '/parent' },
  { name: 'applies `ariaCurrentValue`', props: { to: '/parent', ariaCurrentValue: 'step' }, at: '/parent' },
  { name: 'applies equal active classes to an active parent link', props: { to: '/parent', activeClass: 'on', exactActiveClass: 'on' }, at: '/parent/child/1' },
  { name: 'applies equal active classes to an exact active link', props: { to: '/parent', activeClass: 'on', exactActiveClass: 'on' }, at: '/parent' },
  { name: 'applies kebab-case props', props: { 'to': '/parent', 'active-class': 'on', 'exact-active-class': 'exact-on', 'aria-current-value': 'step' }, at: '/parent' },
  { name: 'merges a fallthrough `class` and `style`', props: { to: '/parent' }, attrs: { class: 'user', style: { color: 'red' } }, at: '/parent' },
  { name: 'appends a trailing slash', options: { trailingSlash: 'append' }, props: { to: '/parent' } },
  { name: 'removes a trailing slash', props: { to: '/parent/', trailingSlash: 'remove' } },
  { name: 'passes slot props', props: { to: '/parent' }, at: '/parent', slot: (p: any) => h('span', { 'class': [p.isActive && 'a', p.isExactActive && 'ea'], 'data-href': p.href, 'data-path': p.route.path }, 'x') },
  { name: 'renders a multi-node slot', props: { to: '/parent' }, slot: () => [h('span', 'a'), h('span', 'b')] },
  { name: 'renders an empty slot', props: { to: '/parent' }, slot: () => [] },
]

const serializeSlotProps = (p: any) => h('a', {
  'data-props': JSON.stringify({
    href: p.href,
    route: p.route && { href: p.route.href, fullPath: p.route.fullPath, name: p.route.name, params: p.route.params, query: p.route.query, hash: p.route.hash, matched: p.route.matched.length },
    isActive: p.isActive,
    isExactActive: p.isExactActive,
    rel: p.rel,
    target: p.target,
    isExternal: p.isExternal,
    prefetched: p.prefetched,
    functions: [typeof p.navigate, typeof p.prefetch, typeof p.shouldPrefetch],
  }),
}, 'x')

const customCases: Case[] = [
  { name: 'renders an inactive link', props: { to: '/parent' } },
  { name: 'renders an empty `to`', props: {} },
  { name: 'renders an active parent link', props: { to: '/parent' }, at: '/parent/child/1' },
  { name: 'renders an exact active link', props: { to: '/parent' }, at: '/parent' },
  { name: 'renders an active leaf link', props: { to: '/parent/child/1' }, at: '/parent/child/1' },
  { name: 'distinguishes links differing only by params', props: { to: '/parent/child/1' }, at: '/parent/child/2' },
  { name: 'resolves an aliased route', props: { to: '/aliased/1' }, at: '/named/1' },
  { name: 'resolves a named route object', props: { to: { name: 'named', params: { id: '2' } } } },
  { name: 'resolves a route object with query and hash', props: { to: { path: '/query', query: { a: 'b c' }, hash: '#h' } }, at: '/query?a=b%20c#h' },
  { name: 'resolves a relative path', props: { to: 'child/1' }, at: '/parent/' },
  { name: 'encodes an unencoded path', props: { to: '/parent/child/a b' } },
  { name: 'appends a trailing slash', options: { trailingSlash: 'append' }, props: { to: '/parent' }, at: '/parent' },
  { name: 'removes a trailing slash', props: { to: '/parent/', trailingSlash: 'remove' }, at: '/parent' },
  { name: 'passes `rel`', props: { to: '/parent', rel: 'nofollow' } },
  { name: 'passes `noRel`', options: { externalRelAttribute: 'opt-rel' }, props: { to: '/parent', noRel: true } },
  { name: 'passes `externalRelAttribute` from options', options: { externalRelAttribute: 'opt-rel' }, props: { to: '/parent' } },
  { name: 'passes a `_self` target', props: { to: '/parent', target: '_self' } },
  { name: 'ignores `replace` and active classes', options: { activeClass: 'opt-on' }, props: { to: '/parent', replace: true, activeClass: 'on', exactActiveClass: 'exact-on' }, at: '/parent' },
  { name: 'falls through attributes to the slot root', props: { to: '/parent' }, attrs: { 'class': 'user', 'data-foo': '1' } },
  { name: 'renders a multi-node slot', props: { to: '/parent' }, slot: () => [h('span', 'a'), h('span', 'b')] },
  { name: 'renders a text slot', props: { to: '/parent' }, slot: () => 'text' },
  { name: 'renders an empty slot', props: { to: '/parent' }, slot: () => [] },
]

describe('nuxt-link ssr', () => {
  for (const testCase of cases) {
    it(testCase.name, async () => {
      const viaRouterLink = await renderLink(testCase, false)
      const viaServerPath = await renderLink(testCase, true)
      expect(viaServerPath).toBe(viaRouterLink)
      expect(await renderLink(testCase, true, true)).toBe(viaRouterLink)
    })
  }

  it('renders a render-function slot once', async () => {
    const slot = vi.fn(() => 'text')
    await renderLink({ name: 'slot', props: { to: '/parent' }, slot }, true, true)
    expect(slot).toHaveBeenCalledOnce()
  })

  describe('custom', () => {
    for (const { props, slot, ...testCase } of customCases) {
      it(testCase.name, async () => {
        const customCase = { ...testCase, props: { ...props, custom: true }, slot: slot ?? serializeSlotProps }
        const viaRouterLink = await renderLink(customCase, false)
        const viaServerPath = await renderLink(customCase, true)
        expect(viaServerPath).toBe(viaRouterLink)
      })
    }
  })
})
