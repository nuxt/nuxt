import { createApp, inject } from 'vue'
import { describe, expect, it } from 'vitest'
import { PageRouteSymbol } from '../src/app/components/injections.ts'

describe('PageRouteSymbol', () => {
  it('is registered in the global symbol registry', () => {
    // So that a second copy of the Nuxt runtime (for example when an app and
    // a layer each resolve their own copy of `nuxt/app`) evaluates to the
    // exact same injection key, rather than a unique `Symbol('route')`.
    expect(PageRouteSymbol).toBe(Symbol.for('nuxt:route'))
  })

  it('resolves a route provided by another copy of the runtime', () => {
    const route = { path: '/search', query: { q: 'nuxt' } }
    // This is the key an independently evaluated copy of this module would
    // compute for the route injection.
    const otherCopySymbol = Symbol.for('nuxt:route')

    const app = createApp({})
    app.provide(otherCopySymbol, route)

    const injected = app.runWithContext(() => inject(PageRouteSymbol, undefined))
    expect(injected).toBe(route)
  })
})
