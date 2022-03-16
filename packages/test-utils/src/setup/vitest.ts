import type { TestHooks } from '../types'

export default async function setupVitest (hooks: TestHooks) {
  const vitest = await import('vitest')
  vitest.beforeAll(hooks.setup, 60000)
  vitest.beforeEach(hooks.beforeEach)
  vitest.afterEach(hooks.afterEach)
  vitest.afterAll(hooks.afterAll)
}
