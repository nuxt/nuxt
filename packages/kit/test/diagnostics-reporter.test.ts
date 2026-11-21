import { stripVTControlCharacters } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Diagnostic } from 'nostics'

import { logger } from '../src/logger.ts'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('diagnostic reporters', () => {
  it('print through the logger rather than `console` outside tests', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, 'warn')
    const { reporters } = await import('../src/diagnostics/_shared.ts')
    const diagnostic = new Diagnostic({ code: 'NUXT_B0000', why: 'Something happened.', fix: 'Fix it.' })

    reporters[0](diagnostic, {})
    reporters[0](diagnostic, { method: 'error' })

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Something happened.'))
    expect(stripVTControlCharacters(String(error.mock.calls[0]![0]))).toContain('fix: Fix it.')
    expect(consoleWarn).not.toHaveBeenCalled()
  })
})
