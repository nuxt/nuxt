import { describe, expect, it, vi } from 'vitest'
import { applyDefaults } from 'untyped'
import { NuxtConfigSchema } from '@nuxt/schema'
import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import { isIgnored, resolveGroupSyntax, resolveIgnorePatterns } from '../src/ignore.ts'
import * as context from '../src/context.ts'

describe('isIgnored', () => {
  it('should populate _ignore', () => {
    const mockNuxt = { options: { ignore: ['my-dir'], _layers: [] } as NuxtConfig } as unknown as Nuxt
    vi.spyOn(context, 'tryUseNuxt').mockReturnValue(mockNuxt)

    expect(isIgnored('my-dir/my-file.ts')).toBe(true)
    expect(resolveIgnorePatterns()?.includes('my-dir')).toBe(true)
  })

  it('should ignore the local state of deploy target tooling by default', async () => {
    const { ignore } = await applyDefaults(NuxtConfigSchema, {})
    const mockNuxt = { options: { ignore, _layers: [] } as unknown as NuxtConfig } as unknown as Nuxt
    vi.spyOn(context, 'tryUseNuxt').mockReturnValue(mockNuxt)

    expect(isIgnored('.wrangler/state/v3/cache/miniflare-CacheObject/db.sqlite-wal')).toBe(true)
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
