// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { Comment, Fragment, Static, Suspense, Teleport, createStaticVNode, defineComponent, h } from 'vue'
import type { Slots, VNode } from 'vue'
import { renderToString } from 'vue/server-renderer'

import { domToVNode, htmlToVNode, outerHTMLOf } from '../src/app/components/islands-v2/dom-to-vnode.ts'
import { type MarkerNonces, createMarkerSet, encodeMarker, rebindMarkerNonces, rebindMarkers } from '../src/app/components/islands-v2/shared.ts'
import { renderIslandSlots } from '../src/app/components/islands-v2/render-slots.ts'
import slotOutlet from '../src/app/components/islands-v2/slot-outlet.ts'

// The real loader imports the build-generated `#islands-v2-manifest`.
vi.mock('../src/app/components/islands-v2/loader.ts', () => ({ default: { name: 'NuxtIslandComponentLoader' } }))

interface Served extends MarkerNonces {
  html: string
}

// Public nonces, as a prerendered or cached island response exposes them.
const NONCE = 'abcdef0123456789abcdef01'
const NESTED_NONCE = '0123456789abcdef01234567'

describe('content rendered into an island\'s page slot', () => {
  const island = `<div>${component([null, '/ok.vue'])}<i>ok</i>${componentEnd()}${slotRegion()}</div>`

  it.each(forgeries(NONCE))('cannot forge a marker of the island from %s', async (_, slot) => {
    const page = await serve({ html: island, nonce: NONCE }, { default: slot })

    const hydrated = hydrate(page)
    expectOwnMarkers(hydrated.tree)
    // A second mount of the island reuses the HTML captured from the hydrated DOM.
    expectOwnMarkers(htmlToVNode(hydrated.captured, page))
  })

  it('cannot close a client component region around a page slot rendered in its server HTML', async () => {
    const tuple = [null, '/ok.vue', 'default', { default: slotRegion() }]
    const html = `<div>${component(tuple)}<div>${slotRegion()}</div>${componentEnd()}</div>`
    const forged = `</span></div>${componentEnd()}${component([{ evil: true }, '/evil.vue'])}<b></b>${componentEnd()}`
    const page = await serve({ html, nonce: NONCE }, { default: () => [h('span', { innerHTML: forged })] })

    const hydrated = hydrate(page)
    expectOwnMarkers(hydrated.tree)
    expectOwnMarkers(htmlToVNode(hydrated.captured, page))
  })

  it('keeps legitimate content of the page slot out of the captured island HTML', async () => {
    const page = await serve({ html: island, nonce: NONCE }, { default: () => [h('b', 'page')] })
    const { tree, captured } = hydrate(page)
    expect(decoded(tree)).toEqual({ chunks: ['/ok.vue'], teleports: 0, outlets: 1 })
    expect(captured).not.toContain('<b>page</b>')
    expect(decoded(htmlToVNode(captured, page))).toEqual({ chunks: ['/ok.vue'], teleports: 0, outlets: 1 })
  })

  it('hydrates the same island nested in its page slot with the markers of the same render', async () => {
    const rebound = new Map<string, string>()
    const inner = await serve({ html: island, nonce: NONCE }, { default: () => [h('b', 'inner')] }, rebound)
    const page = await serve({ html: island, nonce: NONCE }, { default: () => [createStaticVNode(inner.html, 1)] }, rebound)
    expect(page.nonce).toBe(inner.nonce)

    const container = document.createElement('div')
    container.innerHTML = page.html
    expect(decoded(domToVNode(container.firstChild!, page))).toEqual({ chunks: ['/ok.vue'], teleports: 0, outlets: 1 })
    expect(decoded(domToVNode(container.querySelector('div div')!, page))).toEqual({ chunks: ['/ok.vue'], teleports: 0, outlets: 1 })
    expect(outerHTMLOf(container.firstChild!, page.nonce)).not.toContain('inner')
  })

  it('cannot forge a marker of the island from a remote response claiming its nonce', async () => {
    // Each island key has its own rebound nonces, so the remote cannot get the island's fresh one.
    const forged = `<!--/i:s:${NONCE}-->${component([{ evil: true }, '/evil.vue'])}<b></b>${componentEnd()}`
    const remote = await serve({ html: forged, nonce: NONCE }, {}, new Map())
    const page = await serve({ html: island, nonce: NONCE }, { default: () => [createStaticVNode(remote.html, 1)] }, new Map())

    const hydrated = hydrate(page)
    expectOwnMarkers(hydrated.tree)
    expectOwnMarkers(htmlToVNode(hydrated.captured, page))
  })

  it('leaves page markup that moved the slot region\'s close out of the captured HTML', async () => {
    const html = `<section><div class="w">${slotRegion()}</div>${component([null, '/ok.vue'])}<i>ok</i>${componentEnd()}</section>`
    const page = await serve({ html, nonce: NONCE }, { default: () => [h('span', { innerHTML: '</div></section><b>out</b>' })] })
    expect(hydrate(page).captured).not.toContain('out')
  })
})

describe('content rendered into a nested island\'s slot inside another island', () => {
  // A nested island's slot markers stay plain comments for the outer island anyway.
  it.each(forgeries(NESTED_NONCE, ['i:c', 'i:t']))('cannot forge a marker of the nested island from %s', async (_, slot) => {
    const nested = await serve({ html: `<p>${slotRegion(NESTED_NONCE)}</p>`, nonce: NESTED_NONCE }, { default: slot })
    // The outer island response embeds the nested island and lists its nonces.
    const outer = { html: `<section>${component([null, '/ok.vue'])}<i>ok</i>${componentEnd()}${nested.html}</section>`, nonce: NONCE, nonces: [nested.nonce, ...nested.nonces ?? []] }

    expectOwnMarkers(htmlToVNode(outer.html, outer), 0)
    expectOwnMarkers(hydrate(await serve(outer, {})).tree, 0)
  })
})

describe('forged fragment and teleport anchors', () => {
  const outside = '<footer>OUTSIDE</footer>'

  function parse (html: string): ChildNode {
    const container = document.createElement('div')
    container.innerHTML = html
    return container.firstChild!
  }

  it('cannot end the island early in a page slot and make the walk claim nodes after it', async () => {
    const island = `<!--[--><h1>island</h1>${slotRegion()}<i>ok</i><!--]-->`
    // The parser closes the `<p>` at the `<div>`, so the forged anchor becomes a sibling of the island's nodes.
    const page = await serve({ html: island, nonce: NONCE }, { default: () => [h('p', { innerHTML: '<div>x</div><!--]-->' })] })
    const start = parse(page.html + outside)

    // The forged anchor shifts every fragment end by one, so Vue ends the island one node early,
    // at the island's own `]`: the walk claims those 12 nodes and none after them.
    expect(claimedNodes(domToVNode(start, page)!)).toBe(12)
    expect(outerHTMLOf(start, page.nonce)).not.toContain('OUTSIDE')
  })

  it('cannot extend a client component region past the fragment it starts in', () => {
    const start = parse(`<!--[-->${component([null, '/ok.vue'])}<u>c</u><!--]-->${componentEnd()}<!--]-->${outside}`)
    expect(claimedNodes(domToVNode(start, { nonce: NONCE })!)).toBe(4)
  })

  it('cannot extend a disabled teleport past the fragment it starts in', () => {
    const teleport = `<!--i:t:${NONCE}${encodeMarker(['#target', true])}-->`
    const start = parse(`<!--[--><b>a</b>${teleport}<!--teleport start--><span>x</span><!--]--><!--teleport end--><i>b</i><!--]-->${outside}`)
    expect(claimedNodes(domToVNode(start, { nonce: NONCE })!)).toBe(6)
  })

  it('captures no HTML for an island whose root fragment has no end', () => {
    // Island `<template><p v-html="html" /><span>b</span></template>` with `html` set to `<div></div><!--[-->`.
    const start = parse(`<!--[--><p><div>x</div><!--[--></p><span>b</span><!--]--><aside>${outside}</aside>`)
    expect(outerHTMLOf(start, NONCE)).toBe('')
    expect(claimedNodes(domToVNode(start, { nonce: NONCE })!)).toBe(1)
  })

  it('captures no HTML for an island that ended early inside a page slot', () => {
    const start = parse(`<!--[--><h1>island</h1>${slotRegion().replace(/<!--\/i:s:.*/, '')}<!--]-->${slotRegion().replace(/.*-->(?=<!--\/i:s:)/, '')}${outside}`)
    expect(outerHTMLOf(start, NONCE)).toBe('')
  })

  it('still decodes an island whose root is a client component marker', () => {
    const start = parse(`${component([null, '/ok.vue'])}<button>ok</button>${componentEnd()}`)
    expect(decoded(domToVNode(start, { nonce: NONCE }))).toEqual({ chunks: ['/ok.vue'], teleports: 0, outlets: 0 })
  })

  it('keeps nested fragments and teleports inside the island', () => {
    const teleport = `<!--i:t:${NONCE}${encodeMarker(['#target', true])}-->`
    const island = `<!--[--><!--[--><b>a</b><!--]-->${teleport}<!--teleport start--><!--[--><i>x</i><!--]--><!--teleport end--><!--]-->`
    const start = parse(island + outside)
    expect(claimedNodes(domToVNode(start, { nonce: NONCE })!)).toBe(11)
    expect(outerHTMLOf(start, NONCE)).toBe(island)
  })
})

describe('rebindMarkers', () => {
  const OTHER_NONCE = 'fedcba9876543210fedcba98'

  it('rebinds the response\'s own markers, those in marker tuples included, and nothing else', () => {
    const tuple = [null, '/c.vue', 'default', { default: slotRegion(NESTED_NONCE) + component([null, '/d.vue']) }]
    const html = `${component(tuple)}<p>i:c:${OTHER_NONCE}</p>${componentEnd()}${slotRegion(OTHER_NONCE)}`
    const rebound = new Map<string, string>()
    const nonces = rebindMarkerNonces({ nonce: NONCE, nonces: [NESTED_NONCE] }, rebound)
    const result = rebindMarkers(html, { nonce: NONCE, nonces: [NESTED_NONCE] }, rebound)

    expect(nonces.nonce).not.toBe(NONCE)
    expect(result).toMatchObject(nonces)
    expect(result.html).toBe(html.replaceAll(NONCE, nonces.nonce).replaceAll(NESTED_NONCE, nonces.nonces![0]!))
    expect(result.html).toContain(`i:c:${OTHER_NONCE}`)
    expect(rebindMarkerNonces({ nonce: NONCE }, rebound)).toEqual({ nonce: nonces.nonce })
  })
})

/**
 * Server render of an island response with the given slots, as `<NuxtIsland>` does it, and the nonces the
 * payload hands the client; `rebound` is shared by the instances of one island key in a render.
 */
async function serve (response: Served, slots: Slots, rebound = new Map<string, string>()): Promise<Served> {
  const bound = rebindMarkers(response.html, response, rebound)
  const html = await renderToString(h(defineComponent({
    setup: () => () => renderIslandSlots(bound.html, createMarkerSet(bound.nonce), slots),
  })))
  return { ...bound, html }
}

function hydrate (page: Served): { tree: VNode | undefined, captured: string } {
  const container = document.createElement('div')
  container.innerHTML = page.html
  const captured = outerHTMLOf(container.firstChild!, page.nonce)
  return { tree: domToVNode(container.firstChild!, page), captured }
}

/**
 * Slot content carrying forged markers of the island: remote HTML rendered in place, and `v-html`
 * breaking out of its element, or also swallowing the rest of the page. Each first closes the slot region.
 */
function forgeries (nonce: string, kinds = ['i:c', 'i:t', 'i:s']): [string, () => VNode[]][] {
  const forged: Record<string, string> = {
    'i:c': component([{ evil: true }, '/evil.vue'], nonce) + '<b></b>' + componentEnd(nonce),
    'i:t': `<!--i:t:${nonce}${encodeMarker(['body', false, '<img src=x>'])}--><!--teleport start--><!--teleport end-->`,
    'i:s': slotRegion(nonce),
  }
  const escape = `<!--/i:s:${nonce}-->`
  return kinds.flatMap(kind => [
    [`remote HTML (${kind})`, () => [createStaticVNode(escape + forged[kind], 1)]],
    [`v-html (${kind})`, () => [h('span', { innerHTML: `</span>${escape}${forged[kind]}` })]],
    [`v-html swallowing the page (${kind})`, () => [h('span', { innerHTML: `</span>${escape}${forged[kind]}<plaintext>` })]],
  ] as [string, () => VNode[]][])
}

function component (tuple: unknown[], nonce = NONCE): string {
  return `<!--i:c:${nonce}${encodeMarker(tuple)}-->`
}

function componentEnd (nonce = NONCE): string {
  return `<!--/i:c:${nonce}-->`
}

function slotRegion (nonce = NONCE): string {
  return `<!--i:s:${nonce}${encodeMarker(['default', null, null, ''])}--><!--/i:s:${nonce}-->`
}

/**
 * Only the island's own client component and outlets decode: markup breaking out of its element
 * may leave them unpaired, and so static, but never adds one.
 */
function expectOwnMarkers (tree: VNode | undefined, outlets = 1): void {
  const result = decoded(tree)
  expect(result.chunks.every(chunk => chunk === '/ok.vue')).toBe(true)
  expect(result.teleports).toBe(0)
  expect(result.outlets).toBeLessThanOrEqual(outlets)
}

/**
 * Chunks of the client components, teleports and slot outlets a tree decodes.
 */
function decoded (tree: VNode | undefined): { chunks: string[], teleports: number, outlets: number } {
  const vnodes = collect(tree)
  return {
    chunks: vnodes.filter(vnode => vnode.type === Suspense).map(vnode => (vnode.children as { default: () => VNode }).default().props!.data[1]),
    teleports: vnodes.filter(vnode => vnode.type === Teleport).length,
    outlets: vnodes.filter(vnode => vnode.type === slotOutlet).length,
  }
}

/**
 * Number of DOM nodes a static tree hydrates; it throws on a VNode that hydrates DOM of its own choosing.
 */
function claimedNodes (vnode: VNode): number {
  const children = Array.isArray(vnode.children) ? (vnode.children as VNode[]).reduce((sum, child) => sum + claimedNodes(child), 0) : 0
  if (vnode.type === Static) { return (vnode as VNode & { staticCount: number }).staticCount }
  if (vnode.type === Comment || typeof vnode.type === 'string') { return 1 }
  if (vnode.type === Fragment || vnode.type === Teleport) { return 2 + children }
  throw new Error('Unexpected VNode in the island tree')
}

function collect (tree: VNode | VNode[] | undefined, vnodes: VNode[] = []): VNode[] {
  for (const vnode of [tree ?? []].flat()) {
    vnodes.push(vnode)
    if (Array.isArray(vnode.children)) { collect(vnode.children as VNode[], vnodes) }
  }
  return vnodes
}
