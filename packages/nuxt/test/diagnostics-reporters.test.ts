import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { appDiagnostics as AppDiagnostics } from '../src/app/diagnostics/core.ts'

let appDiagnostics: typeof AppDiagnostics

beforeAll(async () => {
  vi.stubGlobal('__TEST_DEV__', true)
  vi.stubGlobal('__TEST_SERVER__', true)
  // Import after stubbing: the reporter set is fixed when the module loads.
  ;({ appDiagnostics } = await import('../src/app/diagnostics/core.ts'))
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('runtime diagnostics reporters', () => {
  it('reports a server diagnostic without the nostics dev reporter', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    appDiagnostics.NUXT_E1014({ key: 'reporterTest', trace: '' })

    const messages = warn.mock.calls.map(args => args.join(' '))
    warn.mockRestore()
    expect(messages.some(message => message.includes('NUXT_E1014'))).toBe(true)
    expect(messages.some(message => message.includes('import.meta.hot.send'))).toBe(false)
  })
})
