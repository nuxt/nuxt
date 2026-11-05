// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createSSRApp, defineComponent } from 'vue'
import type { ComponentInternalInstance } from 'vue'
import { renderToString, ssrRenderSlot } from 'vue/server-renderer'

import { encodeMarker, ssrRenderClientComponent } from '../src/app/components/islands-v2/server.ts'
import { createMarkerNonce, isMarkerNonce } from '../src/app/components/islands-v2/shared.ts'
import type { NuxtSSRContext } from '../src/app/types.ts'

type Push = (item: unknown) => void

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
      } as any, parent, enabled, chunk ?? undefined, 'default'))
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
    const tuple = [1, { value }, 'chunk', 'default', { default: value }]
    const encoded = encodeMarker(tuple)
    expect(encoded).not.toContain('--')
    expect(encoded).not.toContain('<')
    expect(JSON.parse(encoded)).toEqual(tuple)
  })
})

function islandContext (): Pick<NuxtSSRContext, 'islandNonce' | 'islandMarkers'> & { islandNonce: string } {
  return { islandNonce: createMarkerNonce() }
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
    const nonce = context.islandNonce
    const html = await renderToString(createSSRApp(createParent(props)), context)

    expect(html).toContain(`<!--i:c:${nonce}[`)
    expect(html).toContain(`<span>hi</span><!--[--><b>slot</b><!--]--><!--/i:c:${nonce}--></div>`)
    expect(readMarker(html, nonce)).toEqual([1, { msg: 'hi' }, CHUNK, 'default', { default: '<b>slot</b>' }])
  })

  it('stores the marker set on the SSR context and rebuilds it for a new nonce', async () => {
    const context = islandContext()
    await renderToString(createSSRApp(createParent(props)), context)
    const markers = context.islandMarkers
    expect(markers).toMatchObject({ nonce: context.islandNonce, component: `i:c:${context.islandNonce}` })

    await renderToString(createSSRApp(createParent(props)), context)
    expect(context.islandMarkers).toBe(markers)

    context.islandNonce = createMarkerNonce()
    const html = await renderToString(createSSRApp(createParent(props)), context)
    expect(context.islandMarkers?.nonce).toBe(context.islandNonce)
    expect(html).toContain(`<!--i:c:${context.islandNonce}[`)
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
    const nonce = context.islandNonce
    const html = await renderToString(createSSRApp(createParent({ msg: '--><img>' })), context)
    const [marker] = html.match(new RegExp(`<!--i:c:${nonce}.*?-->`))!
    expect(marker.slice(4, -3)).not.toMatch(/--|</)
    expect((readMarker(html, nonce) as unknown[])[1]).toEqual({ msg: '--><img>' })
  })
})
