import { describe, expect, it } from 'vitest'

import { createNitroImportsExcludePatterns } from '../src/imports-exclude'

describe('createNitroImportsExcludePatterns', () => {
  it('includes declaration file exclusion pattern', () => {
    const patterns = createNitroImportsExcludePatterns([])

    expect(patterns.some(re => re.test('/node_modules/pkg/dist/runtime/server/utils/foo.d.ts'))).toBe(true)
    expect(patterns.some(re => re.test('/node_modules/pkg/dist/runtime/server/utils/foo.d.mts'))).toBe(true)
    expect(patterns.some(re => re.test('/node_modules/pkg/dist/runtime/server/utils/foo.d.cts'))).toBe(true)
    expect(patterns.some(re => re.test('/node_modules/pkg/dist/runtime/server/utils/foo.ts'))).toBe(false)
  })

  it('keeps existing caller-provided exclusion patterns', () => {
    const custom = /node_modules\/(?!my-module)/
    const patterns = createNitroImportsExcludePatterns([custom])

    expect(patterns[0]).toBe(custom)
    expect(patterns.some(re => re.test('/repo/.git/config'))).toBe(true)
  })
})
