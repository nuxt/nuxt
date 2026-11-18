import { describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'

import { runsOncePerEnvInMatrix } from './matrix'
import { setupFixture } from './utils'

await setupFixture('server-module-imports', runsOncePerEnvInMatrix)

describe.skipIf(!runsOncePerEnvInMatrix)('server auto-imports registered by a module', () => {
  it('resolves a source only the module can resolve', async () => {
    expect(await $fetch('/api/module-dep')).toEqual({ injected: 'module-only-dep', barrel: 'module-only-dep' })
  })

  it('renders the app', async () => {
    expect(await $fetch<string>('/')).toContain('server module imports')
  })
})
