// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h } from 'vue'
import type { ComponentInternalInstance } from 'vue'
import { renderToString, ssrRenderComponent, ssrRenderSlot } from 'vue/server-renderer'

import { ssrRenderSlot as islandSsrRenderSlot, ssrRenderClientComponent } from '../src/app/components/islands-v2/server.ts'
import { renderIslandSlots } from '../src/app/components/islands-v2/render-slots.ts'
import { createMarkerNonce, createMarkerSet, encodeMarker, isMarkerNonce } from '../src/app/components/islands-v2/shared.ts'
import type { IslandRenderState } from '../src/app/components/islands-v2/shared.ts'

// The real loader imports the build-generated `#islands-v2-manifest`.
vi.mock('../src/app/components/islands-v2/loader.ts', () => ({ default: { name: 'NuxtIslandComponentLoader' } }))

type Push = (item: unknown) => void
// The push the islands compiler hands a slot fallback.
type HtmlPush = (html: string) => void

const BACKSLASH = String.fromCharCode(92)

const CHUNK = '/components/Child.vue'

const Child = defineComponent({
  name: 'Child',
  props: ['msg'],
  ssrRender (ctx: any, push: Push, parent: ComponentInternalInstance) {
    push(`<span>${ctx.msg}</span>`)
    ssrRenderSlot(ctx.$slots, 'default', {}, null, push as any, parent)
  },
})

function createParent (props: Record<string, unknown>, enabled?: boolean, chunk: string | null = CHUNK) {
  return defineComponent({
    ssrRender (_ctx: unknown, push: Push, parent: ComponentInternalInstance) {
      push('<div>')
      // `_: 1` marks the slots as compiled, as the SSR compiler emits them.
      push(ssrRenderClientComponent(Child, props, {
        default: (_props: unknown, slotPush?: Push) => { slotPush?.('<b>slot</b>') },
        _: 1,
      } as any, parent, { enabled, chunk: chunk ?? undefined }))
      push('</div>')
    },
  })
}

function readMarker (html: string, nonce: string): unknown {
  const match = html.match(new RegExp(`<!--i:c:${nonce}(.*?)-->`))
  return match ? JSON.parse(match[1]!) : undefined
}

describe('encodeMarker', () => {
  const values = ['-->', '--!>', '<!--', '--->', '----', '</script>', `${BACKSLASH}--${BACKSLASH}<`, 'a-b', '<!--i:c:x[1]-->']

  it.each(values)('cannot close or open a comment with %j', (value) => {
    const tuple = [{ value }, 'chunk', 'default', { default: value }]
    const encoded = encodeMarker(tuple)
    expect(encoded).not.toContain('--')
    expect(encoded).not.toContain('<')
    expect(JSON.parse(encoded)).toEqual(tuple)
  })
})

function islandContext (): { islands: IslandRenderState } {
  return { islands: { markers: createMarkerSet(createMarkerNonce()), nested: new Set() } }
}

describe('createMarkerNonce', () => {
  it('creates a distinct valid nonce per call', () => {
    const nonce = createMarkerNonce()
    expect(isMarkerNonce(nonce)).toBe(true)
    expect(createMarkerNonce()).not.toBe(nonce)
  })
})

describe('ssrRenderClientComponent', () => {
  const props = {
    msg: 'hi',
    onClick: () => {},
    onUpdateValue: () => {},
    key: 'k',
    ref: 'r',
    ref_for: true,
    ref_key: 'r',
  }

  it('wraps the component in markers bound to the render nonce', async () => {
    const context = islandContext()
    const nonce = context.islands.markers.nonce
    const html = await renderToString(createSSRApp(createParent(props)), context)

    expect(html).toContain(`<!--i:c:${nonce}[`)
    expect(html).toContain(`<span>hi</span><!--[--><b>slot</b><!--]--><!--/i:c:${nonce}--></div>`)
    expect(readMarker(html, nonce)).toEqual([{ msg: 'hi' }, CHUNK, 'default', { default: '<b>slot</b>' }])
  })

  it('renders plain Vue output without a scanned chunk', async () => {
    const html = await renderToString(createSSRApp(createParent(props, undefined, null)), islandContext())
    expect(html).toBe('<div><span>hi</span><!--[--><b>slot</b><!--]--></div>')
  })

  it('renders plain Vue output without a nonce', async () => {
    const html = await renderToString(createSSRApp(createParent(props)), {})
    expect(html).toBe('<div><span>hi</span><!--[--><b>slot</b><!--]--></div>')
  })

  it('renders plain Vue output when `enabled` is false', async () => {
    const context = islandContext()
    const html = await renderToString(createSSRApp(createParent(props, false)), context)
    expect(html).toBe('<div><span>hi</span><!--[--><b>slot</b><!--]--></div>')
  })

  it('escapes comment delimiters in props', async () => {
    const context = islandContext()
    const nonce = context.islands.markers.nonce
    const html = await renderToString(createSSRApp(createParent({ msg: '--><img>' })), context)
    const [marker] = html.match(new RegExp(`<!--i:c:${nonce}.*?-->`))!
    expect(marker.slice(4, -3)).not.toMatch(/--|</)
    expect((readMarker(html, nonce) as unknown[])[0]).toEqual({ msg: '--><img>' })
  })
})

describe('ssrRenderSlot', () => {
  const SCOPE_ID = 'data-v-island-s'

  // Universal child rendering its own `<slot>`, which is never the island root's.
  const Universal = defineComponent({
    ssrRender (ctx: any, push: Push, parent: ComponentInternalInstance) {
      push('<section>')
      islandSsrRenderSlot(ctx.$slots, 'default', {}, (fallbackPush: HtmlPush) => { fallbackPush('<i>child fallback</i>') }, push as any, parent)
      push('</section>')
    },
  })

  const Root = defineComponent({
    ssrRender (ctx: any, push: Push, parent: ComponentInternalInstance) {
      push('<div>')
      islandSsrRenderSlot(ctx.$slots, 'default', { msg: 'hi', onClick: () => {}, fn: () => {}, key: 'k', __proto__: null }, (fallbackPush: HtmlPush) => { fallbackPush('<i>fallback</i>') }, push as any, parent, SCOPE_ID)
      push(ssrRenderComponent(Universal, null, {
        // A root outlet inside a child's slot content is still the root's.
        default: (_: unknown, slotPush: Push, slotParent: ComponentInternalInstance) => {
          islandSsrRenderSlot(ctx.$slots, 'named', {}, null, slotPush as any, slotParent)
        },
        _: 1,
      } as any, parent))
      push('</div>')
    },
  })

  function createIsland (context: { islands?: IslandRenderState }) {
    return createSSRApp({
      render: () => {
        const vnode = h(Root)
        if (context.islands) { context.islands.root = vnode }
        return vnode
      },
    })
  }

  it('writes each island root outlet as an empty slot region with the fallback in its tuple', async () => {
    const context = islandContext()
    const nonce = context.islands.markers.nonce
    const html = await renderToString(createIsland(context), context)

    expect(html).toBe([
      '<div>',
      `<!--i:s:${nonce}${encodeMarker(['default', { msg: 'hi' }, SCOPE_ID, '<i>fallback</i>'])}--><!--/i:s:${nonce}-->`,
      '<section><!--[-->',
      `<!--i:s:${nonce}${encodeMarker(['named', {}, null, ''])}--><!--/i:s:${nonce}-->`,
      '<!--]--></section></div>',
    ].join(''))
  })

  it('keeps outlets nested in a fallback inside its tuple', async () => {
    const context = islandContext()
    const nonce = context.islands.markers.nonce
    const Nested = defineComponent({
      ssrRender (ctx: any, push: Push, parent: ComponentInternalInstance) {
        islandSsrRenderSlot(ctx.$slots, 'outer', {}, (outerPush: HtmlPush) => {
          outerPush('<p>')
          islandSsrRenderSlot(ctx.$slots, 'inner', {}, (innerPush: HtmlPush) => { innerPush('in') }, outerPush as any, parent)
          outerPush('</p>')
        }, push as any, parent)
      },
    })
    const html = await renderToString(createSSRApp({
      render: () => {
        const vnode = h(Nested)
        context.islands.root = vnode
        return vnode
      },
    }), context)
    const inner = `<!--i:s:${nonce}${encodeMarker(['inner', {}, null, 'in'])}--><!--/i:s:${nonce}-->`
    expect(html).toBe(`<!--i:s:${nonce}${encodeMarker(['outer', {}, null, `<p>${inner}</p>`])}--><!--/i:s:${nonce}-->`)
  })

  it('writes the tuple of a root outlet within client component slot HTML', async () => {
    const context = islandContext()
    const nonce = context.islands.markers.nonce
    const ClientRoot = defineComponent({
      ssrRender (ctx: any, push: Push, parent: ComponentInternalInstance) {
        push(ssrRenderClientComponent(Child, null, {
          default: (_: unknown, slotPush: Push, slotParent: ComponentInternalInstance) => {
            islandSsrRenderSlot(ctx.$slots, 'inner', {}, (fallbackPush: HtmlPush) => { fallbackPush('<i>fb</i>') }, slotPush as any, slotParent)
          },
          _: 1,
        } as any, parent, { chunk: CHUNK }))
      },
    })
    const html = await renderToString(createSSRApp({
      render: () => {
        const vnode = h(ClientRoot)
        context.islands.root = vnode
        return vnode
      },
    }), context)
    const slotHtml = `<!--i:s:${nonce}${encodeMarker(['inner', {}, null, '<i>fb</i>'])}--><!--/i:s:${nonce}-->`
    expect((readMarker(html, nonce) as unknown[])[3]).toEqual({ default: slotHtml })
  })

  it('leaves a universal child\'s own outlet unmarked', async () => {
    const context = islandContext()
    const html = await renderToString(createSSRApp({
      render: () => {
        const vnode = h(Root)
        context.islands.root = vnode
        return h(Universal, null, { default: () => [h('b', 'page')] })
      },
    }), context)
    expect(html).toBe('<section><!--[--><b>page</b><!--]--></section>')
  })

  it('renders plain Vue output without a nonce or an island root', async () => {
    // Vue takes a child slot holding only an empty outlet as empty and renders the child's fallback.
    const plain = '<div><!--[--><i>fallback</i><!--]--><section><!--[--><i>child fallback</i><!--]--></section></div>'
    expect(await renderToString(createIsland({}), {})).toBe(plain)
    const context = islandContext()
    expect(await renderToString(createSSRApp(Root), context)).toBe(plain)
  })
})

describe('renderIslandSlots', () => {
  const nonce = createMarkerNonce()
  const markers = createMarkerSet(nonce)
  // An outlet as the island render writes it.
  const region = (tuple: unknown[]) => `<!--i:s:${nonce}${encodeMarker(tuple)}--><!--/i:s:${nonce}-->`

  function render (html: string, slots: Record<string, (props: any) => any>) {
    return renderToString(createSSRApp({ render: () => renderIslandSlots(html, markers, slots as any) }))
  }

  it('keeps HTML without slot regions as is', async () => {
    const html = `<div><!--i:s:${createMarkerNonce()}["default",null,null,""]--><!--/i:s:${nonce}--></div>`
    expect(await render(html, { default: () => [h('b', 'page')] })).toBe(html)
  })

  it('renders page slots in place of the regions, falling back to the marker HTML', async () => {
    const html = `<div>${region(['default', { n: 1 }, 'data-v-island-s', '<i>fb</i>'])}${region(['other', null, null, '<i>other fb</i>'])}</div>`
    const out = await render(html, { default: (props: { n: number }) => [h('b', `page ${props.n}`)] })

    expect(out).toBe([
      '<!--[--><div>',
      `<!--i:s:${nonce}${encodeMarker(['default', { n: 1 }, 'data-v-island-s', '<i>fb</i>'])}-->`,
      '<!--[--><b data-v-island-s>page 1</b><!--]-->',
      `<!--/i:s:${nonce}-->`,
      `<!--i:s:${nonce}${encodeMarker(['other', null, null, '<i>other fb</i>'])}-->`,
      '<!--[--><i>other fb</i><!--]-->',
      `<!--/i:s:${nonce}--></div><!--]-->`,
    ].join(''))
  })

  it('resolves regions nested in a fallback the page does not replace', async () => {
    const html = region(['outer', null, null, `<p>${region(['inner', null, null, 'inner fb'])}</p>`])
    const out = await render(html, { inner: () => [h('b', 'page')] })
    expect(out).toContain(`<!--[--><p><!--i:s:${nonce}${encodeMarker(['inner', null, null, 'inner fb'])}--><!--[--><b>page</b><!--]--><!--/i:s:${nonce}--></p><!--]-->`)
  })

  it('keeps a malformed or unclosed region as text', async () => {
    const html = `<div><!--i:s:${nonce}["__proto__",null,null,""]--><!--/i:s:${nonce}--><!--i:s:${nonce}["default",null,null,""]--><i>x</i></div>`
    expect(await render(html, { default: () => [h('b', 'page')] })).toBe(html)
  })
})
