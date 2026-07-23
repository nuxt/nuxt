import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_VFOR_LENGTH, vforBound } from '#app/components/vfor'

describe('vforBound', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
    vi.unstubAllGlobals()
  })

  it('clamps a numeric source above the cap', () => {
    expect(vforBound(40_000_000)).toBe(MAX_VFOR_LENGTH)
  })

  it('warns in dev when it clamps, so truncation is not silent', () => {
    vi.stubGlobal('__TEST_DEV__', true)
    vforBound(40_000_000)
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]!.join(' ')).toContain('only the first')
  })

  it('does not warn when nothing is clamped', () => {
    vi.stubGlobal('__TEST_DEV__', true)
    vforBound(3)
    vforBound([1, 2, 3])
    expect(warn).not.toHaveBeenCalled()
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
