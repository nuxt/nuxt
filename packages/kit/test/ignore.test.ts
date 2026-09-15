import { describe, expect, it, vi } from 'vitest'
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

  // `nuxt.options.ignore` as the schema resolves it: the built-in declaration pattern, followed
  // by whatever the project configured
  function mockNuxt (configured: string[] = []) {
    const nuxt = {
      options: {
        rootDir: '/project',
        srcDir: '/project',
        alias: {},
        ignore: ['**/*.d.{cts,mts,ts}', ...configured],
        _layers: [{ cwd: '/project', config: { rootDir: '/project', ignore: configured } }],
      },
    } as unknown as Nuxt
    vi.spyOn(context, 'tryUseNuxt').mockReturnValue(nuxt)
    return nuxt
  }

  it('should let declaration files through when asked to', () => {
    const nuxt = mockNuxt()

    expect(isIgnored('/project/types.d.ts', undefined, nuxt)).toBe(true)
    expect(isIgnored('/project/types.d.ts', undefined, nuxt, { declarations: true })).toBe(false)
  })

  it('should keep ignoring declaration files the project ignores itself', () => {
    const nuxt = mockNuxt(['**/*.d.ts', 'internal/**'])

    expect(isIgnored('/project/types.d.ts', undefined, nuxt, { declarations: true })).toBe(true)
    expect(isIgnored('/project/types.d.mts', undefined, nuxt, { declarations: true })).toBe(false)
    expect(isIgnored('/project/internal/types.d.mts', undefined, nuxt, { declarations: true })).toBe(true)
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
