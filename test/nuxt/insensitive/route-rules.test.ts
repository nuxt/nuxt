import { describe, expect, it } from 'vitest'

import { getRouteRules } from '#app/composables/manifest'

// With `router.options.sensitive: false`, mixed-case route-rule keys must still match any
// request casing. `ssr` and `redirect` exercise the same key-folding path `appMiddleware` uses.
describe('insensitive routing folds mixed-case route-rule keys', () => {
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

  it('applies a rule with a regex constraint for any request casing', () => {
    for (const path of ['/Range/ABC', '/range/abc', '/RANGE/Abc', '/range/_']) {
      expect(getRouteRules({ path }), path).toMatchObject({ ssr: false })
    }
    expect(getRouteRules({ path: '/range/123' })).not.toMatchObject({ ssr: false })
  })

  it('moves the tail of the path onto a wildcard redirect target for any request casing', () => {
    for (const path of ['/Wild/A/b', '/wild/A/b', '/WILD/A/b']) {
      expect(getRouteRules({ path }), path).toMatchObject({ redirect: '/target/A/b' })
    }
  })

  it('folds a non-ASCII character that arrives percent-encoded', () => {
    for (const path of ['/cafÉ', '/café', `/caf${encodeURIComponent('É')}`, `/caf${encodeURIComponent('é')}`]) {
      expect(getRouteRules({ path }), path).toMatchObject({ redirect: '/accented-target' })
    }
  })
})
