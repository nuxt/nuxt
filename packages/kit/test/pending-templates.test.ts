import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildDiagnostics } from '../src/diagnostics/build.ts'
import { reportPendingTemplates, trackPendingTemplate } from '../src/internal/pending-templates.ts'

describe('trackPendingTemplate', () => {
  const exitCode = process.exitCode
  const settle: Array<() => void> = []

  afterEach(async () => {
    while (settle.length) { settle.pop()!() }
    await Promise.resolve()
    process.exitCode = exitCode
    vi.restoreAllMocks()
  })

  /** A template left pending for the duration of a single test. */
  function hang (filename: string) {
    void trackPendingTemplate(filename, () => new Promise<string>(resolve => settle.push(() => resolve(''))))
  }

  it('reports nothing once every template has settled', async () => {
    expect(await trackPendingTemplate('settles.mjs', () => 'contents')).toBe('contents')
    await expect(trackPendingTemplate('rejects.mjs', () => Promise.reject(new Error('nope')))).rejects.toThrow('nope')

    expect(reportPendingTemplates()).toBe(false)
    expect(process.exitCode).toBe(exitCode)
  })

  it('fails the process for a template whose contents never settle', () => {
    const report = vi.spyOn(buildDiagnostics, 'NUXT_B1022').mockImplementation(() => ({}) as any)
    hang('never-settles.mjs')

    expect(reportPendingTemplates()).toBe(true)
    expect(report.mock.calls[0]![0]).toMatchObject({ count: 1, templates: '`never-settles.mjs`' })
    expect(process.exitCode).toBe(1)
  })

  it('tracks templates sharing a filename independently', async () => {
    const report = vi.spyOn(buildDiagnostics, 'NUXT_B1022').mockImplementation(() => ({}) as any)
    hang('dup.mjs')
    expect(await trackPendingTemplate('dup.mjs', () => 'contents')).toBe('contents')

    expect(reportPendingTemplates()).toBe(true)
    expect(report.mock.calls[0]![0]).toMatchObject({ count: 1, templates: '`dup.mjs`' })
    expect(process.exitCode).toBe(1)
  })
})
