import { describe, expect, it } from 'vitest'

import { getRouteRules } from '#app/composables/manifest'

// With `router.options.sensitive: true`, route rules must preserve the configured casing
// rather than being case-folded.
describe('sensitive routing preserves route-rule casing', () => {
  it('matches the exact configured casing', () => {
    expect(getRouteRules({ path: '/Admin/Dashboard' })).toMatchObject({ redirect: '/admin-target' })
    expect(getRouteRules({ path: '/admin/dashboard' })).toMatchObject({ redirect: '/lower-target' })
  })

  it('does not fold a lowercase request onto an uppercase key', () => {
    expect(getRouteRules({ path: '/ADMIN/DASHBOARD' })).not.toHaveProperty('redirect')
  })
})
