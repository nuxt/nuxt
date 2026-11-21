// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type Component, type Slots, createSSRApp, h, nextTick, ref } from 'vue'

import { domToVNode } from '../src/app/components/islands-v2/dom-to-vnode.ts'
import { encodeMarker } from '../src/app/components/islands-v2/shared.ts'

const chunks = vi.hoisted(() => new Map<string, { promise: Promise<unknown>, resolve: (component: unknown) => void }>())

vi.mock('#islands-v2-manifest', () => ({
  chunkPaths: {},
  importFn: (src: string) => {
    let entry = chunks.get(src)
    if (!entry) {
      let resolve!: (component: unknown) => void
      chunks.set(src, entry = { promise: new Promise((res) => { resolve = res }), resolve })
    }
    return entry.promise
  },
}))

const NONCE = 'abcdef0123456789abcdef01'
const CLOSE = `<!--/i:c:${NONCE}-->`
const INNER = `<!--i:c:${NONCE}${encodeMarker([null, '/inner.vue', 'default'])}--><i id="inner">inner</i>${CLOSE}`
const PAIR = `<!--i:c:${NONCE}${encodeMarker([null, '/pair.vue', 'default', {}, 1])}--><!--[--><p id="half">server</p><!--]-->${CLOSE}`
const OUTLET = `<!--i:s:${NONCE}${encodeMarker(['default', null, null, ''])}--><!--/i:s:${NONCE}-->`
const PAGE_SLOTS: Slots = { default: () => [h('em', 'page')] }

const COMPONENTS: Record<string, Component> = {
  '/inner.vue': { render: () => h('i', { id: 'inner' }, 'inner') },
  '/pair.vue': { render: () => h('p', { id: 'half' }, 'client') },
}

let errors: unknown[]
let warnings: string[]

beforeEach(() => {
  chunks.clear()
  errors = []
  warnings = []
})

afterEach(() => {
  expect(errors).toEqual([])
  expect(warnings).toEqual([])
})

describe('slot HTML of a client component', () => {
  it.each([
    ['static HTML', '<b>static</b>', '<b>static</b>', '<b>static</b>'],
    ['an ordinary target', `<b>a</b>${INNER}`, `<b>a</b>${INNER}`, `<b>a</b>${INNER}`],
    ['a mount pair', PAIR, PAIR, `<!--i:c:${NONCE}${encodeMarker([null, '/pair.vue', 'default', {}, 1])}--><p id="half">client</p>${CLOSE}`],
    ['a page slot outlet', `<b>a</b>${OUTLET}`, `<b>a</b>${OUTLET.replace('--><!--/', '--><!--[--><em>page</em><!--]--><!--/')}`, `<b>a</b>${OUTLET.replace('--><!--/', '--><!--[--><em>page</em><!--]--><!--/')}`],
  ])('renders again after being hidden, with %s', async (_, slotHtml, serverHtml, loadedHtml) => {
    const open = ref(true)
    const toggle: Component = { setup: (_props, { slots }) => () => h('div', open.value ? slots.default!() : []) }
    const container = island(`${outer(slotHtml)}<div>${serverHtml}</div>${CLOSE}`)
    await hydrate(container, toggle)
    const loaded = `<section>${outer(slotHtml)}<div>${loadedHtml}</div>${CLOSE}</section>`
    expect(markup(container)).toBe(withoutAnchors(loaded))

    open.value = false
    await flush()
    expect(markup(container)).toBe(withoutAnchors(`<section>${outer(slotHtml)}<div></div>${CLOSE}</section>`))
    open.value = true
    await flush()
    expect(markup(container)).toBe(withoutAnchors(loaded))
  })

  it('hydrates the same slot rendered twice at once', async () => {
    const twice: Component = { setup: (_props, { slots }) => () => h('div', [h('span', slots.default!()), h('span', slots.default!())]) }
    const slotHtml = `<b>a</b>${INNER}`
    const container = island(`${outer(slotHtml)}<div><span>${slotHtml}</span><span>${slotHtml}</span></div>${CLOSE}`)
    await hydrate(container, twice)
    expect(container.querySelectorAll('#inner')).toHaveLength(2)
    expect(markup(container)).toBe(withoutAnchors(`<section>${outer(slotHtml)}<div><span>${slotHtml}</span><span>${slotHtml}</span></div>${CLOSE}</section>`))
  })

  it('mounts, removes and mounts again copies rendered side by side, teleports included', async () => {
    const target = document.createElement('div')
    target.id = 'target'
    document.body.append(target)
    const count = ref(0)
    const list: Component = { setup: (_props, { slots }) => () => h('div', Array.from({ length: count.value }, (_, i) => h('span', { key: i }, slots.default!()))) }
    const teleport = `<!--i:t:${NONCE}${encodeMarker(['#target', false, `<u>moved</u>${INNER}`])}--><!--teleport start--><!--teleport end-->`
    const slotHtml = `<b>a</b> text ${INNER}${teleport}`
    const container = island(`${outer(slotHtml)}<div></div>${CLOSE}`)
    await hydrate(container, list)
    const copy = `<b>a</b> text ${INNER}<!--i:t:${NONCE}${encodeMarker(['#target', false, `<u>moved</u>${INNER}`])}--><!--teleport start--><!--teleport end-->`
    const expectCopies = (n: number) => {
      expect(markup(container)).toBe(withoutAnchors(`<section>${outer(slotHtml)}<div>${`<span>${copy}</span>`.repeat(n)}</div>${CLOSE}</section>`))
      expect(target.innerHTML).toBe(`<u>moved</u>${INNER}`.repeat(n))
    }

    for (const n of [2, 1, 0, 2]) {
      count.value = n
      await flush()
      expectCopies(n)
    }
    target.remove()
  })

  it('shows the slot outlet fallback again after the page slot content goes away', async () => {
    const show = ref(true)
    const pageSlots: Slots = { default: () => show.value ? [h('em', 'page')] : [] }
    const fallbackOutlet = `<!--i:s:${NONCE}${encodeMarker(['default', null, null, `<b>fb</b>${INNER}`])}--><!--/i:s:${NONCE}-->`
    const container = island(`${fallbackOutlet.replace('--><!--/', '--><!--[--><em>page</em><!--]--><!--/')}`)
    await hydrate(container, undefined, pageSlots)
    for (const value of [false, true, false]) {
      show.value = value
      await flush()
      expect(markup(container)).toBe(withoutAnchors(`<section>${fallbackOutlet.replace('--><!--/', `--><!--[-->${value ? '<em>page</em>' : `<b>fb</b>${INNER}`}<!--]--><!--/`)}</section>`))
    }
  })
})

function outer (slotHtml: string): string {
  return `<!--i:c:${NONCE}${encodeMarker([null, '/outer.vue', 'default', { default: slotHtml }])}-->`
}

function island (html: string): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = `<section>${html}</section>`
  return container
}

async function hydrate (container: HTMLElement, outerComponent: Component | undefined, slots = PAGE_SLOTS): Promise<void> {
  const vnode = domToVNode(container.firstChild!, { nonce: NONCE, slots })!
  const app = createSSRApp({ render: () => vnode })
  app.config.errorHandler = (error) => { errors.push(error) }
  app.config.warnHandler = (message) => { warnings.push(message) }
  app.mount(container)
  await flush()
  if (outerComponent) {
    chunks.get('/outer.vue')!.resolve(outerComponent)
    await flush()
  }
  for (const [src, component] of Object.entries(COMPONENTS)) {
    chunks.get(src)?.resolve(component)
  }
  // Later loads of a chunk get the same resolved promise.
  for (const src of Object.keys(COMPONENTS)) {
    if (!chunks.has(src)) { chunks.set(src, { promise: Promise.resolve(COMPONENTS[src]), resolve: () => {} }) }
  }
  await flush()
}

async function flush (): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setTimeout(resolve))
    await nextTick()
  }
}

// Vue writes fragment anchors as comments on the server and as empty text nodes on the client.
function markup (container: HTMLElement): string {
  return withoutAnchors(container.innerHTML)
}

function withoutAnchors (html: string): string {
  return html.replaceAll('<!--[-->', '').replaceAll('<!--]-->', '')
}
