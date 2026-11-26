import { describe, expect, it, vi } from 'vitest'
import type { RouteLocationMatched, RouteLocationNormalizedLoaded } from 'vue-router'
import { MatcherPatternPathDynamic, MatcherPatternPathStatic } from 'vue-router/experimental'
import { generateRouteKey } from '../src/pages/runtime/utils.ts'
import type { RouterViewSlotProps } from '../src/pages/runtime/utils.ts'

vi.mock('#build/nuxt.config.mjs', () => ({ experimentalRouter: true }))

const Component = {}

function routeKey (path: MatcherPatternPathStatic | MatcherPatternPathDynamic<Record<string, unknown>>, params: Record<string, unknown>) {
  const record = { path, components: { default: Component }, meta: {} } as unknown as RouteLocationMatched
  const route = { params, matched: [record] } as unknown as RouteLocationNormalizedLoaded
  return generateRouteKey({ route, Component: { type: Component } } as unknown as RouterViewSlotProps)
}

describe('experimental route key', () => {
  it('interpolates the matcher parts like the classic path', () => {
    expect(routeKey(new MatcherPatternPathStatic('/about'), {})).toBe('/about')
    const user = new MatcherPatternPathDynamic(/^\/users\/([^/]+)\/?$/i, { id: [] }, ['users', 1])
    expect(routeKey(user, { id: '42' })).toBe('/users/42')
    const mixed = new MatcherPatternPathDynamic(/^\/user-([^/]+)\/edit\/?$/i, { id: [] }, [['user-', 1], 'edit'])
    expect(routeKey(mixed, { id: '7' })).toBe('/user-7/edit')
  })

  it('keeps a trailing slash of a catch-all in the key, so the page remounts when it changes', () => {
    const catchAll = new MatcherPatternPathDynamic(/^\/files(?:\/(.*))?$/i, { slug: [undefined, true, true] }, ['files', 0])
    expect(routeKey(catchAll, { slug: ['a', 'b'] })).toBe('/files/a,b')
    expect(routeKey(catchAll, { slug: ['a', 'b', ''] })).toBe('/files/a,b,')
    expect(routeKey(catchAll, { slug: [] })).toBe('/files/')
    expect(routeKey(catchAll, { slug: null })).toBe('/files/')
  })
})
