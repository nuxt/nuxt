import { describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import type { VNode } from 'vue'
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

async function renderLink (testCase: Case, server: boolean) {
  vi.stubGlobal('__TEST_SERVER__', server)

  const router = createRouter({ history: createMemoryHistory(), routes, ...testCase.routerOptions })
  nuxtApp.$router = router
  await router.push(testCase.at ?? '/')
  await router.isReady()

  const Link = defineNuxtLink({ componentName: 'NuxtLink', ...testCase.options })
  const app = createApp(defineComponent({
    setup: () => () => h('div', [h(Link as any, { ...testCase.props, ...testCase.attrs }, testCase.slot ?? (() => 'text'))]),
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
  { name: 'appends a trailing slash', options: { trailingSlash: 'append' }, props: { to: '/parent' } },
  { name: 'removes a trailing slash', props: { to: '/parent/', trailingSlash: 'remove' } },
  { name: 'passes slot props', props: { to: '/parent' }, at: '/parent', slot: (p: any) => h('span', { 'class': [p.isActive && 'a', p.isExactActive && 'ea'], 'data-href': p.href, 'data-path': p.route.path }, 'x') },
  { name: 'renders a multi-node slot', props: { to: '/parent' }, slot: () => [h('span', 'a'), h('span', 'b')] },
  { name: 'renders an empty slot', props: { to: '/parent' }, slot: () => [] },
]

describe('nuxt-link ssr', () => {
  for (const testCase of cases) {
    it(testCase.name, async () => {
      const viaRouterLink = await renderLink(testCase, false)
      const viaServerPath = await renderLink(testCase, true)
      expect(viaServerPath).toBe(viaRouterLink)
    })
  }
})
