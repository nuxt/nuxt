import { describe, expect, it } from 'vitest'

import { getRouteRules } from '#app/composables/manifest'

// Routing is case-insensitive by default, so mixed-case route-rule keys must still match any
// request casing. `ssr` and `redirect` exercise the same key-folding path `appMiddleware` uses.
describe('case-insensitive route rules fold mixed-case keys', () => {
  it('applies an uppercase-keyed ssr rule for any request casing', () => {
    for (const path of ['/Secret/Docs/index', '/secret/docs/index', '/SECRET/DOCS/index']) {
      expect(getRouteRules({ path }), path).toMatchObject({ ssr: false })
    }
  })

  it('applies an uppercase-keyed redirect rule for any request casing', () => {
    for (const path of ['/Legacy/Home', '/legacy/home', '/LEGACY/HOME']) {
      expect(getRouteRules({ path }), path).toMatchObject({ redirect: '/target' })
    }
  })
})
