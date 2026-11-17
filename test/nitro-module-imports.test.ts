import { describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'

import { isNitroV3, runsOnceInMatrix } from './matrix'
import { setupFixture } from './utils'

// asserts how the nitropack builder scopes auto-imports
const runs = runsOnceInMatrix && !isNitroV3

await setupFixture('nitro-module-imports', runs)

describe.skipIf(!runs)('nitro auto-imports opted out', () => {
  it('resolves h3 and nitro helpers imported from `#imports` in an installed module', async () => {
    expect(await $fetch('/api/installed/explicit?id=1')).toEqual({ query: { id: '1' }, baseURL: '/' })
  })

  it('resolves h3 and nitro helpers imported from `#imports` in a local module', async () => {
    expect(await $fetch('/api/local/explicit?id=2')).toEqual({ query: { id: '2' }, baseURL: '/' })
  })

  it('auto-imports h3 and nitro helpers in a local module', async () => {
    expect(await $fetch('/api/local/injected?id=3')).toEqual({ query: { id: '3' }, baseURL: '/' })
  })

  it('does not auto-import h3 and nitro helpers in project code', async () => {
    expect(await $fetch('/api/project')).toEqual({ getQuery: 'undefined', useRuntimeConfig: 'undefined' })
  })
})
