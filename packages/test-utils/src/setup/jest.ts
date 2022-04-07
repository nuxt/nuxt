import type { TestHooks } from '../types'

export default function setupJest (hooks: TestHooks) {
  // TODO: add globals existing check to provide better error message
  // @ts-expect-error jest types
  test('setup', hooks.setup, 120 * 1000)
  // @ts-expect-error jest types
  beforeEach(hooks.beforeEach)
  // @ts-expect-error jest types
  afterEach(hooks.afterEach)
  // @ts-expect-error jest types
  afterAll(hooks.afterAll)
}
