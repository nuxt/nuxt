import type { TestHooks } from '../types'

export default async function setupJest (hooks: TestHooks) {
  // @ts-ignore
  const jest = await import('jest')

  hooks.ctx.mockFn = jest.fn

  // TODO: add globals existing check to provide better error message
  // @ts-expect-error jest types
  test('setup', hooks.setup, hooks.ctx.options.setupTimeout)
  // @ts-expect-error jest types
  beforeEach(hooks.beforeEach)
  // @ts-expect-error jest types
  afterEach(hooks.afterEach)
  // @ts-expect-error jest types
  afterAll(hooks.afterAll)
}
