import { describe, expect, it, vi } from 'vitest'
import { isIgnored, resolveGroupSyntax } from './ignore.js'
import * as context from './context.js'
import type { Nuxt, NuxtOptions } from '@nuxt/schema'

describe('isIgnored', () => {
  it('should populate _ignore', () => {
    const mockNuxt = { options: { ignore: ['my-dir'] } as NuxtOptions } as Nuxt
    vi.spyOn(context, 'tryUseNuxt').mockReturnValue(mockNuxt)

    expect(isIgnored('my-dir/my-file.ts')).toBe(true)
  })

  it('should update _ignore', () => {
    const mockNuxt = { options: { ignore: ['my-dir/*'] } as NuxtOptions } as Nuxt
    vi.spyOn(context, 'tryUseNuxt').mockReturnValue(mockNuxt)

    expect(isIgnored('my-dir/my-file.ts')).toBe(true)
    expect(isIgnored('my-dir/my-tracked-file.ts')).toBe(true)

    mockNuxt.options.ignore.push('!my-dir/my-tracked-file.ts')
    vi.spyOn(context, 'tryUseNuxt').mockReturnValue(mockNuxt)

    expect(isIgnored('my-dir/my-tracked-file.ts')).toBe(false)
  })
})

describe('resolveGroupSyntax', () => {
  it('should resolve single group syntax', () => {
    expect(resolveGroupSyntax('**/*.{spec}.{js,ts}')).toStrictEqual([
      '**/*.spec.js',
      '**/*.spec.ts',
    ])
  })

  it('should resolve multi-group syntax', () => {
    expect(resolveGroupSyntax('**/*.{spec,test}.{js,ts}')).toStrictEqual([
      '**/*.spec.js',
      '**/*.spec.ts',
      '**/*.test.js',
      '**/*.test.ts',
    ])
  })

  it('should do nothing with normal globs', () => {
    expect(resolveGroupSyntax('**/*.spec.js')).toStrictEqual([
      '**/*.spec.js',
    ])
  })
})
