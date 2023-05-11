import type { TestHooks } from '../types'

export default async function setupJest (hooks: TestHooks) {
  const { jest, test, beforeEach, afterAll, afterEach } = await import('@jest/globals')

  hooks.ctx.mockFn = jest.fn

  test('setup', hooks.setup, hooks.ctx.options.setupTimeout)
  beforeEach(hooks.beforeEach)
  afterEach(hooks.afterEach)
  afterAll(hooks.afterAll)
}
