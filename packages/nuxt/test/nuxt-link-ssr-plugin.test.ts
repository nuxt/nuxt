import { describe, expect, it } from 'vitest'

import { NuxtLinkClientPlugin, NuxtLinkSsrPlugin } from '../src/components/plugins/nuxt-link-ssr.ts'

const plugin = NuxtLinkSsrPlugin.raw({}, {} as any) as any

async function transform (code: string, id = 'test.vue'): Promise<string | undefined> {
  return (await plugin.transform.handler(code, id))?.code
}

describe('nuxt:nuxt-link-ssr', () => {
  it('renders template links with `ssrRenderNuxtLink`', async () => {
    expect(await transform('_push(_ssrRenderComponent(_component_NuxtLink, { to: "/" }, null, _parent))')).toMatchInlineSnapshot(`
      "import { ssrRenderNuxtLink as __nuxt_ssrRenderNuxtLink } from "#app/components/nuxt-link-ssr-render";
      _push(__nuxt_ssrRenderNuxtLink(_component_NuxtLink, { to: "/" }, null, _parent))"
    `)
  })

  it('handles kebab-case links, the un-prefixed helper and several calls', async () => {
    const code = 'ssrRenderComponent(_component_nuxt_link, a, b, c); ssrRenderComponent(_component_NuxtLink, a, b, c)'
    expect((await transform(code))?.split('\n')[1])
      .toBe('__nuxt_ssrRenderNuxtLink(_component_nuxt_link, a, b, c); __nuxt_ssrRenderNuxtLink(_component_NuxtLink, a, b, c)')
  })

  it('leaves other components alone', async () => {
    const code = '_push(_ssrRenderComponent(_component_NuxtPage, props, null, _parent)); _push(_ssrRenderComponent(_component_NuxtLinkCard, props, null, _parent)); _push(_ssrRenderComponent(_unref(NuxtLink), props, slots, _parent))'
    expect(await transform(code)).toBeUndefined()
  })

  it('only applies to Vue files that render links', () => {
    const filter = plugin.transform.filter
    expect(filter.id.include.test('pages/index.vue')).toBe(true)
    expect(filter.id.include.test('pages/index.vue?vue&type=script')).toBe(true)
    expect(filter.id.include.test('composables/useFoo.ts')).toBe(false)
    expect(filter.code.include.test('_push(_ssrRenderComponent(_component_Foo, null, null, _parent))')).toBe(false)
  })
})

describe('nuxt:nuxt-link-client', () => {
  const clientPlugin = NuxtLinkClientPlugin.raw({}, {} as any) as any
  const transformClient = async (code: string) => (await clientPlugin.transform.handler(code, 'test.vue'))?.code

  it('creates template links with `createNuxtLinkVNode` and `createNuxtLinkBlock`', async () => {
    expect(await transformClient('_createVNode(_component_NuxtLink, { to: "/" }, null); (_openBlock(), _createBlock(_component_nuxt_link, { key: 0, to: "/" }))')).toMatchInlineSnapshot(`
      "import { createNuxtLinkVNode as __nuxt_createNuxtLinkVNode, createNuxtLinkBlock as __nuxt_createNuxtLinkBlock } from "#app/components/nuxt-link";
      __nuxt_createNuxtLinkVNode(_component_NuxtLink, { to: "/" }, null); (_openBlock(), __nuxt_createNuxtLinkBlock(_component_nuxt_link, { key: 0, to: "/" }))"
    `)
  })

  it('leaves other components alone', async () => {
    expect(await transformClient('_createVNode(_component_NuxtLinkCard, props); _createVNode(_unref(NuxtLink), props)')).toBeUndefined()
  })

  it('leaves components with cached vnodes alone', async () => {
    expect(await transformClient('_cache[0] || (_setBlockTracking(-1, true), (_cache[0] = _createVNode(_component_NuxtLink, { to: "/" })).cacheIndex = 0, _setBlockTracking(1), _cache[0])')).toBeUndefined()
    expect(await transformClient('if (_isMemoSame(_cached, [a])) return _cached; _createVNode(_component_NuxtLink, { to: "/" })')).toBeUndefined()
  })
})
