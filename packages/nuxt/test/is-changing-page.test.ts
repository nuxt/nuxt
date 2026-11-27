import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { isChangingPage } from '#app/components/utils'

const page = {}

function route (path: string, meta: Record<string, unknown> = {}, component = page) {
  return { path, meta, params: {}, matched: [{ components: { default: component } }] } as unknown as RouteLocationNormalized
}

describe('isChangingPage', () => {
  it('compares the paths of routes rendering the same component', () => {
    expect(isChangingPage(route('/a'), route('/a'))).toBe(false)
    expect(isChangingPage(route('/a'), route('/b'))).toBe(true)
    expect(isChangingPage(route('/time/10:30'), route('/time/10:45'))).toBe(true)
  })

  it('compares the page keys when set', () => {
    expect(isChangingPage(route('/a', { key: 'static' }), route('/b', { key: 'static' }))).toBe(false)
    const key = (r: RouteLocationNormalized) => r.path.slice(0, 2)
    expect(isChangingPage(route('/a1', { key }), route('/a2', { key }))).toBe(false)
    expect(isChangingPage(route('/a1', { key }), route('/b1', { key }))).toBe(true)
  })

  it('detects a change of component', () => {
    expect(isChangingPage(route('/a', { key: 'static' }), route('/a', { key: 'static' }, {}))).toBe(true)
  })
})
