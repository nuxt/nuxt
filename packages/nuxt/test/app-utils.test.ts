import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { getUserTrace as GetUserTrace } from '../src/app/utils.ts'

const captureStackTrace = vi.hoisted(() => vi.fn())

vi.mock('errx', () => ({ captureStackTrace }))

let getUserTrace: typeof GetUserTrace

beforeAll(async () => {
  vi.stubGlobal('__TEST_DEV__', true)
  // Import after stubbing because `distURL` is initialized from `import.meta.dev`.
  ;({ getUserTrace } = await import('../src/app/utils.ts'))
})

beforeEach(() => {
  captureStackTrace.mockReset()
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('getUserTrace', () => {
  it('includes a user frame at the end of the trace', () => {
    captureStackTrace.mockReturnValue([
      { source: 'file:///project/node_modules/nuxt/runtime.js' },
      { source: 'file:///project/app/page.vue', line: 2, column: 3 },
    ])

    expect(getUserTrace()).toEqual([
      { source: '/project/node_modules/nuxt/runtime.js' },
      { source: '/project/app/page.vue', line: 2, column: 3 },
    ])
  })

  it('excludes trailing dependency frames', () => {
    captureStackTrace.mockReturnValue([
      { source: 'file:///project/app/page.vue' },
      { source: 'file:///project/app/middleware.ts' },
      { source: 'file:///project/node_modules/router/runtime.js' },
    ])

    expect(getUserTrace()).toEqual([
      { source: '/project/app/page.vue' },
      { source: '/project/app/middleware.ts' },
    ])
  })

  it('returns an empty trace when no user frame exists', () => {
    captureStackTrace.mockReturnValue([
      { source: 'file:///project/node_modules/nuxt/runtime.js' },
      { source: 'file:///project/node_modules/router/runtime.js' },
    ])

    expect(getUserTrace()).toEqual([])
  })
})
