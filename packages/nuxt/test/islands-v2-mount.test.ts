// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type Component, createSSRApp, h, nextTick, render } from 'vue'

import { domToVNode, htmlToVNode } from '../src/app/components/islands-v2/dom-to-vnode.ts'
import { isComponentMarker } from '../src/app/components/islands-v2/markers.ts'
import { encodeMarker } from '../src/app/components/islands-v2/shared.ts'

const chunks = vi.hoisted(() => new Map<string, { promise: Promise<unknown>, resolve: (component: unknown) => void, reject: (error: Error) => void }>())

vi.mock('#islands-v2-manifest', () => ({
  chunkPaths: {},
  importFn: (src: string) => {
    let entry = chunks.get(src)
    if (!entry) {
      let resolve!: (component: unknown) => void
      let reject!: (error: Error) => void
      chunks.set(src, entry = { promise: new Promise((res, rej) => { resolve = res; reject = rej }), resolve, reject })
    }
    return entry.promise
  },
}))

const NONCE = 'abcdef0123456789abcdef01'
const CLOSE = `<!--/i:c:${NONCE}-->`
const SERVER = '<p id="half">server</p>'
const CLIENT: Component = { render: () => h('p', { id: 'half' }, 'client') }
const UNIVERSAL: Component = { render: () => h('p', { id: 'half' }, 'server') }

let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  chunks.clear()
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  expect(warn).not.toHaveBeenCalled()
  warn.mockRestore()
})

describe('component marker mount flag', () => {
  it.each([
    [[null, '/c.vue', 'default', {}, 1], true],
    [[null, '/c.vue', 'default', { default: '<b>s</b>' }, 1], true],
    [[null, '/c.vue', 'default', {}, true], false],
    [[null, '/c.vue', 'default', {}, 2], false],
    [[null, '/c.vue', 'default', {}, '1'], false],
  ])('validates %j', (tuple, valid) => {
    expect(isComponentMarker(tuple)).toBe(valid)
  })
})

describe('paired client half', () => {
  it('keeps the server half until the chunk loads, then mounts the client half without hydrating it', async () => {
    const container = island(`${pair()}<!--[-->${SERVER}<!--]-->${CLOSE}<span>after</span>`)
    await hydrate(container)
    expect(container.querySelector('#half')!.textContent).toBe('server')

    await load('/pair.vue', CLIENT)
    expect(container.innerHTML).toBe(`<section>${pair()}<p id="half">client</p>${CLOSE}<span>after</span></section>`)
  })

  it('replaces a multi-root server half and keeps the slots from the tuple', async () => {
    const tuple = pair({ default: '<b>slot</b>' })
    const container = island(`${tuple}<!--[--><!--[--><i>a</i><i>b</i><!--]--><!----><!--]-->${CLOSE}`)
    await hydrate(container)
    expect(container.querySelectorAll('i')).toHaveLength(2)

    await load('/pair.vue', { render (this: { $slots: Record<string, () => unknown> }) { return h('p', this.$slots.default!() as never) } })
    expect(container.innerHTML).toBe(`<section>${tuple}<p><b>slot</b></p>${CLOSE}</section>`)
  })

  it('mounts in place of the server half rendered from fetched HTML, and again on a refetch', async () => {
    const container = document.createElement('div')
    const html = `<section>${pair()}<!--[-->${SERVER}<!--]-->${CLOSE}</section>`
    const first = htmlToVNode(html, { nonce: NONCE })!
    render(first, container)
    expect(container.querySelector('#half')!.textContent).toBe('server')
    await load('/pair.vue', CLIENT)
    expect(container.querySelector('#half')!.textContent).toBe('client')

    render(htmlToVNode(html, { nonce: NONCE, previous: first })!, container)
    await flush()
    expect(container.innerHTML).toBe(`<section>${pair()}<p id="half">client</p>${CLOSE}</section>`)
  })

  it('mounts a pair nested in a client component\'s slot HTML', async () => {
    const inner = `${pair()}<!--[-->${SERVER}<!--]-->${CLOSE}`
    const outer = `<!--i:c:${NONCE}${encodeMarker([null, '/outer.vue', 'default', { default: inner }])}-->`
    const container = island(`${outer}<div>${inner}</div>${CLOSE}`)
    await hydrate(container)

    await load('/outer.vue', { render (this: { $slots: Record<string, () => unknown> }) { return h('div', this.$slots.default!() as never) } })
    expect(container.querySelector('#half')!.textContent).toBe('server')
    await load('/pair.vue', CLIENT)
    expect(container.innerHTML).toBe(`<section>${outer}<div>${pair()}<p id="half">client</p>${CLOSE}</div>${CLOSE}</section>`)
  })

  it('keeps the island intact when refetched before the chunk loads, next to an identical static run', async () => {
    const container = document.createElement('div')
    const html = `<section>${pair()}<!--[-->${SERVER}<!--]-->${CLOSE}${SERVER}</section>`
    const first = htmlToVNode(html, { nonce: NONCE })!
    render(first, container)
    render(htmlToVNode(html, { nonce: NONCE, previous: first })!, container)
    await flush()
    expect(container.innerHTML).toBe(`<section>${pair()}${SERVER}${CLOSE}${SERVER}</section>`)

    await load('/pair.vue', CLIENT)
    expect(container.innerHTML).toBe(`<section>${pair()}<p id="half">client</p>${CLOSE}${SERVER}</section>`)
  })

  it('keeps the server half when the chunk fails to load', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const container = island(`${pair()}<!--[-->${SERVER}<!--]-->${CLOSE}`)
    await hydrate(container)
    chunks.get('/pair.vue')!.reject(new Error('offline'))
    await flush()
    expect(container.querySelector('#half')!.textContent).toBe('server')
    error.mockRestore()
    // Vue reports the failed loader through its error handler.
    warn.mockClear()
  })

  it('loads only the latest chunk when the data changes before the first one resolves', async () => {
    const container = document.createElement('div')
    const html = (chunk: string) => `<section><!--i:c:${NONCE}${encodeMarker([null, chunk, 'default', {}, 1])}--><!--[-->${SERVER}<!--]-->${CLOSE}</section>`
    const first = htmlToVNode(html('/a.vue'), { nonce: NONCE })!
    render(first, container)
    render(htmlToVNode(html('/b.vue'), { nonce: NONCE, previous: first })!, container)
    await load('/b.vue', CLIENT)
    await load('/a.vue', { render: () => h('p', 'stale') })
    expect(container.querySelector('#half')!.textContent).toBe('client')
  })

  it('renders a remote pair whose chunk the host does not list statically', async () => {
    const container = document.createElement('div')
    render(htmlToVNode(`<section>${pair()}<!--[-->${SERVER}<!--]-->${CLOSE}</section>`, { nonce: NONCE, remote: { source: 'https://remote.test', chunks: {} } })!, container)
    await flush()
    expect(chunks.size).toBe(0)
    expect(container.querySelector('#half')!.textContent).toBe('server')
  })

  it('hydrates the region when the anchors are missing', async () => {
    const container = island(`${pair()}${SERVER}${CLOSE}`)
    const server = container.querySelector('#half')
    await hydrate(container)
    await load('/pair.vue', UNIVERSAL)
    expect(container.querySelector('#half')).toBe(server)
  })
})

describe('universal targets', () => {
  it('still hydrate the server DOM in place', async () => {
    const container = island(`<!--i:c:${NONCE}${encodeMarker([null, '/universal.vue', 'default'])}-->${SERVER}${CLOSE}`)
    const server = container.querySelector('#half')
    await hydrate(container)
    await load('/universal.vue', UNIVERSAL)
    expect(container.querySelector('#half')).toBe(server)
  })
})

function pair (slots?: Record<string, string>): string {
  return `<!--i:c:${NONCE}${encodeMarker([null, '/pair.vue', 'default', slots ?? {}, 1])}-->`
}

function island (html: string): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = `<section>${html}</section>`
  return container
}

async function hydrate (container: HTMLElement): Promise<void> {
  const vnode = domToVNode(container.firstChild!, { nonce: NONCE })!
  createSSRApp({ render: () => vnode }).mount(container)
  await flush()
}

async function load (chunk: string, component: unknown): Promise<void> {
  const entry = chunks.get(chunk)
  expect(entry, `${chunk} was requested`).toBeDefined()
  entry!.resolve(component)
  await flush()
}

async function flush (): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setTimeout(resolve))
    await nextTick()
  }
}
