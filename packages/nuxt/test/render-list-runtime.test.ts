import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderList as vueRenderList } from 'vue'
import { ssrRenderList as vueSsrRenderList } from 'vue/server-renderer'
import { renderList, ssrRenderList } from '#app/components/render-list'
import { MAX_VFOR_LENGTH } from '#app/components/vfor'

const nuxtApp = vi.hoisted(() => ({ current: null as null | { ssrContext?: { islandContext?: object } } }))

vi.mock('#app/nuxt', () => ({
  tryUseNuxtApp: () => nuxtApp.current,
}))

const helpers = {
  ssrRenderList: (source: unknown) => {
    const items: unknown[][] = []
    ssrRenderList(source, (...args) => { items.push(args) })
    return items
  },
  renderList: (source: unknown) => renderList(source as number, (...args) => args) as unknown[][],
}

const vueHelpers: typeof helpers = {
  ssrRenderList: (source) => {
    const items: unknown[][] = []
    vueSsrRenderList(source, (...args) => { items.push(args) })
    return items
  },
  renderList: source => vueRenderList(source as number, (...args) => args) as unknown[][],
}

describe.each(Object.keys(helpers) as Array<keyof typeof helpers>)('%s', (name) => {
  const render = helpers[name]

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    nuxtApp.current = null
    vi.restoreAllMocks()
  })

  it('clamps a numeric source during an island render', () => {
    nuxtApp.current = { ssrContext: { islandContext: {} } }
    const items = render(MAX_VFOR_LENGTH + 5)
    expect(items).toHaveLength(MAX_VFOR_LENGTH)
    expect(items.at(-1)?.slice(0, 2)).toEqual([MAX_VFOR_LENGTH, MAX_VFOR_LENGTH - 1])
  })

  it('does not clamp outside an island render', () => {
    nuxtApp.current = { ssrContext: {} }
    expect(render(MAX_VFOR_LENGTH + 5)).toHaveLength(MAX_VFOR_LENGTH + 5)
  })

  it('does not clamp without a Nuxt app', () => {
    expect(render(MAX_VFOR_LENGTH + 5)).toHaveLength(MAX_VFOR_LENGTH + 5)
  })

  it.each([
    ['numbers at the cap', MAX_VFOR_LENGTH],
    ['arrays', Array.from({ length: MAX_VFOR_LENGTH + 5 }, (_, i) => i)],
    ['strings', 'abc'],
    ['iterables', new Set([1, 2, 3])],
    ['objects', { a: 1, b: 2 }],
    ['negative numbers', -1],
    ['non-integers', 2.5],
  ])('matches Vue for %s during an island render', (_, source) => {
    nuxtApp.current = { ssrContext: { islandContext: {} } }
    expect(render(source)).toEqual(vueHelpers[name](source))
  })
})
