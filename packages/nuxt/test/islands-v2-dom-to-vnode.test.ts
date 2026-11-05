// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { Comment, Fragment, Static, Suspense, Teleport, render } from 'vue'
import type { VNode } from 'vue'

import { domToVNode, htmlToVNode, htmlToVNodes } from '../src/app/components/islands-v2/dom-to-vnode.ts'
import { encodeMarker } from '../src/app/components/islands-v2/server.ts'

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
    const html = `${open([1, null, '/c.vue'], NESTED_NONCE)}<i>x</i>${close(NESTED_NONCE)}`
    const vnodes = children(htmlToVNode(html, { nonce: NONCE }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Comment, Static, Comment])
  })

  it('turns a valid marker into a loader boundary', () => {
    const tuple = [1, { msg: '--><b>' }, '/c.vue', 'default', { default: '<b>slot</b>' }]
    const vnodes = children(htmlToVNode(`${open(tuple)}<i>x</i>${close()}`, { nonce: NONCE }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Comment, Suspense, Comment])
    expect(vnodes[2]!.children).toBe(`/i:c:${NONCE}`)
    expect(loaderProps(vnodes[1]!)).toMatchObject({ data: tuple, nonce: NONCE })
  })

  it('pairs a marker with its own closing comment when nested', () => {
    const html = `${open([1, null, '/outer.vue'])}${open([1, null, '/inner.vue'])}<i>x</i>${close()}${close()}<p>after</p>`
    const vnodes = children(htmlToVNode(html, { nonce: NONCE }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Comment, Suspense, Comment, Static])
    expect(loaderProps(vnodes[1]!).data[2]).toBe('/outer.vue')
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
    const html = `${open([1, null, '/outer.vue'])}${open([1, null, '/inner.vue'], NESTED_NONCE)}<i>x</i>${close(NESTED_NONCE)}${close()}${open([1, null, '/nested.vue'], NESTED_NONCE)}<i>y</i>${close(NESTED_NONCE)}`

    const vnodes = children(htmlToVNode(html, { nonce: NONCE, nonces: [NESTED_NONCE] }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Comment, Suspense, Comment, Comment, Suspense, Comment])
    expect(loaderProps(vnodes[1]!).data[2]).toBe('/outer.vue')
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
    const tuple = `[1,{${JSON.stringify(key)}:{}},"/c.vue"]`
    const html = `<!--i:c:${NONCE}${tuple}--><i>x</i>${close()}`
    const vnodes = children(htmlToVNode(html, { nonce: NONCE }))
    expect(vnodes.map(vnode => vnode.type)).toEqual([Comment, Static, Comment])
  })

  it('rejects a marker whose slots carry a prototype key', () => {
    const html = `<!--i:c:${NONCE}[1,null,"/c.vue","default",{"__proto__":"x"}]--><i>x</i>${close()}`
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
    container.innerHTML = `<section class="island"><p>static</p>${open([1, null, '/c.vue'])}<i>x</i>${close()}</section>`
    const root = domToVNode(container.firstChild!, { nonce: NONCE })!
    expect(root.type).toBe('section')
    expect(root.props).toEqual({ class: 'island' })
    expect((root.children as VNode[]).map(vnode => vnode.type)).toEqual([Static, Comment, Suspense, Comment])
  })
})
