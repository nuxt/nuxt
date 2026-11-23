import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface RuntimeFlags {
  dev?: boolean
  server?: boolean
  hot?: boolean
}

let warn: MockInstance<(...args: any[]) => void>

// The reporter set is fixed when the module loads, so stub the flags first and reload per case.
function stubRuntimeFlags (flags: RuntimeFlags) {
  vi.resetModules()
  vi.stubGlobal('__TEST_DEV__', flags.dev ?? false)
  vi.stubGlobal('__TEST_SERVER__', flags.server ?? false)
  vi.stubGlobal('__TEST_HOT__', flags.hot ?? false)
}

const warnings = () => warn.mock.calls.map(args => args.join(' ')).join('\n')

describe('runtime diagnostics reporters', () => {
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
    vi.unstubAllGlobals()
  })

  it('reports a server diagnostic without the nostics dev reporter', async () => {
    stubRuntimeFlags({ dev: true, server: true, hot: true })

    const { appDiagnostics } = await import('../src/app/diagnostics/core.ts')
    appDiagnostics.NUXT_E1014({ key: 'reporterTest', trace: '' })

    expect(warnings()).toContain('NUXT_E1014')
    // A regex literal, so the test project's `import.meta` transform leaves it alone.
    expect(warnings()).not.toMatch(/import\.meta\.hot\.send/)
  })

  it('does not add the dev reporter where there is no hot channel', async () => {
    stubRuntimeFlags({ dev: true, hot: false })

    const { reporters } = await import('../src/app/diagnostics/_shared.ts')

    expect(reporters).toHaveLength(1)
  })

  it('adds the dev reporter in the browser', async () => {
    stubRuntimeFlags({ dev: true, hot: true })

    const { reporters } = await import('../src/app/diagnostics/_shared.ts')

    expect(reporters).toHaveLength(2)
  })
})
