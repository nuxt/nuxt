// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { Comment, Fragment, Static, Suspense, Teleport, h, render } from 'vue'
import type { VNode } from 'vue'

import { domToVNode, htmlToVNode, htmlToVNodes, outerHTMLOf } from '../src/app/components/islands-v2/dom-to-vnode.ts'
import { encodeMarker } from '../src/app/components/islands-v2/shared.ts'
import slotOutlet from '../src/app/components/islands-v2/slot-outlet.ts'

// The real loader imports the build-generated `#islands-v2-manifest`.
vi.mock('../src/app/components/islands-v2/loader.ts', () => ({ default: { name: 'NuxtIslandComponentLoader' } }))

const NONCE = 'abcdef0123456789abcdef01'
const NESTED_NONCE = '0123456789abcdef01234567'

function open (tuple: unknown[], nonce = NONCE): string {
  return `<!--i:c:${nonce}${encodeMarker(tuple)}-->`
}

function close (nonce = NONCE): string {
  return `<!--/i:c:${nonce}-->`
}

function children (vnode: VNode | undefined): VNode[] {
  expect(vnode?.type).toBe(Fragment)
  return vnode!.children as VNode[]
}

function loaderProps (vnode: VNode): Record<string, any> {
  expect(vnode.type).toBe(Suspense)
  return (vnode.children as { default: () => VNode }).default().props!
}

describe('htmlToVNode', () => {
  it('keeps plain comments as comments', () => {
    const [comment, run] = children(htmlToVNode('<!-- hello --><p>a</p>', { nonce: NONCE }))
    expect(comment!.type).toBe(Comment)
    expect(comment!.children).toBe(' hello ')
    expect(run!.type).toBe(Static)
  })

  it('treats a marker with another nonce as a plain comment', () => {
    const html = `${open([null, '/c.vue'], NESTED_NONCE)}<i>x</i>${close(NESTED_NONCE)}`
    const vnodes = children(htmlToVNode(html, { nonce: NONCE }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Comment, Static, Comment])
  })

  it('turns a valid marker into a loader boundary', () => {
    const tuple = [{ msg: '--><b>' }, '/c.vue', 'default', { default: '<b>slot</b>' }]
    const vnodes = children(htmlToVNode(`${open(tuple)}<i>x</i>${close()}`, { nonce: NONCE }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Comment, Suspense, Comment])
    expect(vnodes[2]!.children).toBe(`/i:c:${NONCE}`)
    expect(loaderProps(vnodes[1]!)).toMatchObject({ data: tuple, nonce: NONCE })
  })

  it('pairs a marker with its own closing comment when nested', () => {
    const html = `${open([null, '/outer.vue'])}${open([null, '/inner.vue'])}<i>x</i>${close()}${close()}<p>after</p>`
    const vnodes = children(htmlToVNode(html, { nonce: NONCE }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Comment, Suspense, Comment, Static])
    expect(loaderProps(vnodes[1]!).data[1]).toBe('/outer.vue')
  })

  it('rebuilds a disabled teleport from its inline content', () => {
    const html = `<!--i:t:${NONCE}${encodeMarker(['#target', true])}--><!--teleport start--><span>in</span><!--teleport end-->`
    const [, teleport] = children(htmlToVNode(html, { nonce: NONCE }))
    expect(teleport!.type).toBe(Teleport)
    expect(teleport!.props).toEqual({ to: '#target', disabled: true })
    expect((teleport!.children as VNode[]).map(vnode => vnode.type)).toEqual([Static])
  })

  it('rebuilds an enabled teleport from the HTML in its marker', () => {
    const html = `<!--i:t:${NONCE}${encodeMarker(['body', false, '<b>moved</b>'])}--><!--teleport start--><!--teleport end-->`
    const [, teleport] = children(htmlToVNode(html, { nonce: NONCE }))
    expect(teleport!.type).toBe(Teleport)
    const [run] = teleport!.children as VNode[]
    expect(run!.type).toBe(Static)
    expect(run!.children).toBe('<b>moved</b>')
  })

  it('reuses unchanged static runs of the previous tree', () => {
    const container = document.createElement('div')
    const previous = htmlToVNode('<p>keep</p><!--sep--><p>old</p>', { nonce: NONCE })!
    render(previous, container)
    expect(container.innerHTML).toBe('<p>keep</p><!--sep--><p>old</p>')

    const next = children(htmlToVNode('<p>keep</p><!--sep--><p>new</p>', { nonce: NONCE, previous }))
    const before = children(previous)
    expect(next[0]).toBe(before[0])
    expect(next[2]).not.toBe(before[2])
  })

  it('accepts markers of nested island nonces', () => {
    const html = `${open([null, '/outer.vue'])}${open([null, '/inner.vue'], NESTED_NONCE)}<i>x</i>${close(NESTED_NONCE)}${close()}${open([null, '/nested.vue'], NESTED_NONCE)}<i>y</i>${close(NESTED_NONCE)}`

    const vnodes = children(htmlToVNode(html, { nonce: NONCE, nonces: [NESTED_NONCE] }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Comment, Suspense, Comment, Comment, Suspense, Comment])
    expect(loaderProps(vnodes[1]!).data[1]).toBe('/outer.vue')
    expect(vnodes[2]!.children).toBe(`/i:c:${NONCE}`)
    expect(loaderProps(vnodes[4]!)).toMatchObject({ nonce: NONCE, nonces: [NESTED_NONCE] })
    expect(vnodes[5]!.children).toBe(`/i:c:${NESTED_NONCE}`)

    const own = children(htmlToVNode(html, { nonce: NONCE }))
    expect(own.slice(0, 3).map(vnode => vnode.type)).toEqual([Comment, Suspense, Comment])
    expect(own.slice(3).map(vnode => vnode.type)).toEqual([Comment, Static, Comment])
  })

  it('rejects an invalid nested nonce', () => {
    expect(() => htmlToVNode('<p>a</p>', { nonce: NONCE, nonces: ['short'] })).toThrow(/marker nonce/)
  })

  it.each(['key', 'ref', 'ref_for', 'ref_key', '__proto__', 'constructor', 'prototype'])('rejects a marker whose props carry %s', (key) => {
    const tuple = `[{${JSON.stringify(key)}:{}},"/c.vue"]`
    const html = `<!--i:c:${NONCE}${tuple}--><i>x</i>${close()}`
    const vnodes = children(htmlToVNode(html, { nonce: NONCE }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Comment, Static, Comment])
  })

  it('rejects a marker whose slots carry a prototype key', () => {
    const html = `<!--i:c:${NONCE}[null,"/c.vue","default",{"__proto__":"x"}]--><i>x</i>${close()}`
    const vnodes = children(htmlToVNode(html, { nonce: NONCE }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Comment, Static, Comment])
  })
})

describe('htmlToVNodes', () => {
  it('serializes static runs for slot content', () => {
    const [run] = htmlToVNodes('<b>a</b>text', { nonce: NONCE })
    expect(run!.type).toBe(Static)
    expect(run!.children).toBe('<b>a</b>text')
  })
})

describe('domToVNode', () => {
  it('walks the live DOM down to the markers', () => {
    const container = document.createElement('div')
    container.innerHTML = `<section class="island"><p>static</p>${open([null, '/c.vue'])}<i>x</i>${close()}</section>`
    const root = domToVNode(container.firstChild!, { nonce: NONCE })!
    expect(root.type).toBe('section')
    expect(root.props).toEqual({ class: 'island' })
    expect((root.children as VNode[]).map(vnode => vnode.type)).toEqual([Static, Comment, Suspense, Comment])
  })
})

describe('slot markers', () => {
  const slotOpen = (tuple: unknown[], nonce = NONCE) => `<!--i:s:${nonce}${encodeMarker(tuple)}-->`
  const slotClose = (nonce = NONCE) => `<!--/i:s:${nonce}-->`
  // An empty region with the fallback in the tuple, as the island handler sends it.
  const region = ([name, props, slotScopeId = null]: unknown[], fallback: string, nonce = NONCE) => `${slotOpen([name, props, slotScopeId, fallback], nonce)}${slotClose(nonce)}`

  it('turns an own slot marker into an outlet with the fallback from the tuple', () => {
    const slots = { default: () => [h('b', 'page')] }
    const vnodes = children(htmlToVNode(`<p>a</p>${region(['default', { n: 1 }, 'data-v-x-s'], '<i>fb</i>')}`, { nonce: NONCE, slots }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Static, Comment, slotOutlet, Comment])
    expect(vnodes[3]!.children).toBe(`/i:s:${NONCE}`)
    const props = vnodes[2]!.props!
    expect(props).toMatchObject({ islandSlots: slots, name: 'default', slotProps: { n: 1 }, slotScopeId: 'data-v-x-s' })
    expect(props.fallback.map((vnode: VNode) => vnode.type)).toEqual([Static])
  })

  it('takes the fallback from the tuple once the page rendered its content in place', () => {
    const html = `${slotOpen(['default', null, null, '<i>fb</i>'])}<!--[--><b>page</b><!--]-->${slotClose()}`
    const [, outlet] = children(htmlToVNode(html, { nonce: NONCE }))
    expect(outlet!.type).toBe(slotOutlet)
    const [run] = outlet!.props!.fallback as VNode[]
    expect(run!.children).toBe('<i>fb</i>')
  })

  it('renders the page slot, or the fallback without one', () => {
    const html = `<div>${region(['default', { n: 2 }, 'data-v-x-s'], '<i>fb</i>')}</div>`
    const container = document.createElement('div')
    render(htmlToVNode(html, { nonce: NONCE, slots: { default: (props: { n: number }) => [h('b', `page ${props.n}`)] } })!, container)
    expect(container.querySelector('b')?.outerHTML).toBe('<b data-v-x-s="">page 2</b>')
    expect(container.querySelector('i')).toBeNull()

    const fallback = document.createElement('div')
    render(htmlToVNode(html, { nonce: NONCE })!, fallback)
    expect(fallback.querySelector('i')?.textContent).toBe('fb')
  })

  it('pairs an outlet with its own closing comment when nested in a fallback', () => {
    const html = `${region(['outer', null], region(['inner', null], '<i>in</i>'))}<p>after</p>`
    const vnodes = children(htmlToVNode(html, { nonce: NONCE }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Comment, slotOutlet, Comment, Static])
    const fallback = vnodes[1]!.props!.fallback as VNode[]
    expect(fallback.map(vnode => vnode.type)).toEqual([Comment, slotOutlet, Comment])
    expect(fallback[1]!.props!.name).toBe('inner')
  })

  it('resolves a slot marker inside a client component\'s slot HTML against the island slots', () => {
    const slots = { default: () => [] }
    const tuple = [null, '/c.vue', 'default', { default: region(['default', null], '') }]
    const [, boundary] = children(htmlToVNode(`${open(tuple)}<i>x</i>${close()}`, { nonce: NONCE, slots }))
    expect(loaderProps(boundary!)).toMatchObject({ islandSlots: slots })
  })

  it('keeps a slot marker of a nested island as static content', () => {
    const html = region(['default', null], '<i>fb</i>', NESTED_NONCE)
    const vnodes = children(htmlToVNode(html, { nonce: NONCE, nonces: [NESTED_NONCE] }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Comment, Comment])
  })

  it.each([
    ['a prototype slot name', '["__proto__",null]'],
    ['reserved props', '["default",{"key":1}]'],
    ['an invalid scope id', '["default",null,"onclick"]'],
    ['non-string fallback', '["default",null,null,1]'],
    ['no fallback', '["default",null,null]'],
    ['a non-array tuple', '{"name":"default"}'],
  ])('rejects a slot marker with %s', (_, tuple) => {
    const html = `<!--i:s:${NONCE}${tuple}--><!--[--><i>fb</i><!--]-->${slotClose()}`
    const vnodes = children(htmlToVNode(html, { nonce: NONCE }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Comment, Fragment, Comment])
  })

  it('hydrates the live DOM with the page content between the anchors', () => {
    const container = document.createElement('div')
    container.innerHTML = `<section>${slotOpen(['default', null, null, '<i>fb</i>'])}<!--[--><b>page</b><!--]-->${slotClose()}</section>`
    const root = domToVNode(container.firstChild!, { nonce: NONCE })!
    expect(root.type).toBe('section')
    expect((root.children as VNode[]).map(vnode => vnode.type)).toEqual([Comment, slotOutlet, Comment])
  })
})

describe('outerHTMLOf', () => {
  it('serializes a fragment root up to its matching end, comments and escaped text included', () => {
    const container = document.createElement('div')
    const island = `<!--[--><!--i:c:${NONCE}[null,"/c.vue"]-->a &amp; b<!--[--><p>x</p><!--]--><!--/i:c:${NONCE}--><!--]-->`
    container.innerHTML = `${island}<p>after</p>`
    expect(outerHTMLOf(container.firstChild!, NONCE)).toBe(island)
    expect(outerHTMLOf(container.lastChild!, NONCE)).toBe('<p>after</p>')
  })
})

describe('remote islands', () => {
  const remote = { source: 'https://remote.test' }
  const teleport = (tuple: unknown[], nonce = NONCE) => `<!--i:t:${nonce}${encodeMarker(tuple)}-->`

  it('keeps an enabled teleport marker as a plain comment, dropping the content it carries', () => {
    const html = `${teleport(['body', false, '<b>moved</b>'])}<!--teleport start--><!--teleport end--><p>after</p>`
    const vnodes = children(htmlToVNode(html, { nonce: NONCE, remote }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Comment, Comment, Comment, Static])
    const container = document.createElement('div')
    render(htmlToVNode(html, { nonce: NONCE, remote })!, container)
    expect(container.innerHTML).not.toContain('<b>moved</b>')
    expect(document.body.innerHTML).not.toContain('<b>moved</b>')
  })

  it('keeps the inline content of a disabled teleport marker in place', () => {
    const html = `${teleport(['#target', true])}<!--teleport start--><span>in</span><!--teleport end-->`
    const vnodes = children(htmlToVNode(html, { nonce: NONCE, remote }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Comment, Comment, Static, Comment])
  })

  it('applies the same rules to the markers of nested islands', () => {
    const html = `${teleport(['body', false, '<b>x</b>'], NESTED_NONCE)}<!--teleport start--><!--teleport end-->${open([null, '/c.vue'], NESTED_NONCE)}<i>x</i>${close(NESTED_NONCE)}`
    const vnodes = children(htmlToVNode(html, { nonce: NONCE, nonces: [NESTED_NONCE], remote }))
    expect(vnodes.some(vnode => vnode.type === Teleport || vnode.type === Suspense)).toBe(false)
  })

  it('renders a client component statically by default', () => {
    const html = `${open([null, '/c.vue'])}<i>server html</i>${close()}`
    const vnodes = children(htmlToVNode(html, { nonce: NONCE, remote }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Comment, Static, Comment])
  })

  it('hydrates a client component whose chunk the host may load', () => {
    const withChunks = { ...remote, chunks: { '/c.vue': '/_nuxt/c.js' } }
    const html = `${open([null, '/c.vue'])}<i>x</i>${close()}${open([null, '/other.vue'])}<i>y</i>${close()}`
    const vnodes = children(htmlToVNode(html, { nonce: NONCE, remote: withChunks }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Comment, Suspense, Comment, Comment, Static, Comment])
    expect(loaderProps(vnodes[1]!)).toMatchObject({ data: [null, '/c.vue'], remote: withChunks })
  })

  it('ignores a chunk listed only on the prototype', () => {
    const html = `${open([null, 'constructor'])}<i>x</i>${close()}`
    const vnodes = children(htmlToVNode(html, { nonce: NONCE, remote: { ...remote, chunks: {} } }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Comment, Static, Comment])
  })

  it('still renders host slots at the slot markers', () => {
    const html = `<!--i:s:${NONCE}${encodeMarker(['default', null, null, '<i>fb</i>'])}--><!--/i:s:${NONCE}-->`
    const vnodes = children(htmlToVNode(html, { nonce: NONCE, remote }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Comment, slotOutlet, Comment])
  })
})
