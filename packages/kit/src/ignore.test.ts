import { describe, expect, it, vi } from 'vitest'
import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import { isIgnored, resolveGroupSyntax, resolveIgnorePatterns } from './ignore.ts'
import * as context from './context.ts'

describe('isIgnored', () => {
  it('should populate _ignore', () => {
    const mockNuxt = { options: { ignore: ['my-dir'], _layers: [] } as NuxtConfig } as unknown as Nuxt
    vi.spyOn(context, 'tryUseNuxt').mockReturnValue(mockNuxt)

    expect(isIgnored('my-dir/my-file.ts')).toBe(true)
    expect(resolveIgnorePatterns()?.includes('my-dir')).toBe(true)
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
