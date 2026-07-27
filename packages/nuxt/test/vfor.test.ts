import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_VFOR_LENGTH, vforBound } from '#app/components/vfor'

describe('vforBound', () => {
  let reported: Array<MockInstance<(...args: any[]) => void>>

  // The catalog picks its reporter (`console.warn` in dev, `console.error` in prod) when the
  // module is first loaded, so assert on whichever channel it settled on.
  const reportedText = () => reported.flatMap(spy => spy.mock.calls.map((call: unknown[]) => call.join(' '))).join('\n')

  beforeEach(() => {
    reported = [
      vi.spyOn(console, 'warn').mockImplementation(() => {}),
      vi.spyOn(console, 'error').mockImplementation(() => {}),
    ]
  })

  afterEach(() => {
    for (const spy of reported) { spy.mockRestore() }
    vi.unstubAllGlobals()
  })

  it('clamps a numeric source above the cap', () => {
    expect(vforBound(40_000_000)).toBe(MAX_VFOR_LENGTH)
  })

  it('reports in dev when it clamps, so truncation is not silent', () => {
    vi.stubGlobal('__TEST_DEV__', true)
    vforBound(40_000_000)
    expect(reportedText()).toContain('NUXT_E4017')
  })

  it('does not report when nothing is clamped', () => {
    vi.stubGlobal('__TEST_DEV__', true)
    vforBound(3)
    vforBound([1, 2, 3])
    expect(reportedText()).toBe('')
  })

  it('does not report outside dev', () => {
    vforBound(40_000_000)
    expect(reportedText()).toBe('')
  })

  it('passes through numbers at or below the cap', () => {
    expect(vforBound(3)).toBe(3)
    expect(vforBound(MAX_VFOR_LENGTH)).toBe(MAX_VFOR_LENGTH)
  })

  it('leaves non-numeric sources untouched', () => {
    const arr = [1, 2, 3]
    expect(vforBound(arr)).toBe(arr)
    expect(vforBound('abc')).toBe('abc')
    const obj = { a: 1 }
    expect(vforBound(obj)).toBe(obj)
  })
})
