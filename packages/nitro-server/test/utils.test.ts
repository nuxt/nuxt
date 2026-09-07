import { matchesGlob } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getLayerNodeModulesExcludePattern, toFsDriverIgnorePatterns } from '../src/utils.ts'

describe('getLayerNodeModulesExcludePattern', () => {
  it('falls back to a bare node_modules pattern when no layers live in node_modules', () => {
    const re = getLayerNodeModulesExcludePattern(['/proj/'])
    expect(re.test('/proj/node_modules/anything/x.ts')).toBe(true)
    expect(re.test('/proj/app/x.ts')).toBe(false)
  })

  it('does not exclude files belonging to a flat-installed layer', () => {
    const re = getLayerNodeModulesExcludePattern(['/proj/node_modules/foo/'])
    expect(re.test('/proj/node_modules/foo/server/api/x.ts')).toBe(false)
    expect(re.test('/proj/node_modules/other/x.ts')).toBe(true)
  })

  it('does not exclude files belonging to layers nested inside another layer (npm)', () => {
    const re = getLayerNodeModulesExcludePattern([
      '/proj/node_modules/a/',
      '/proj/node_modules/a/node_modules/b/',
    ])
    expect(re.test('/proj/node_modules/a/server/x.ts')).toBe(false)
    expect(re.test('/proj/node_modules/a/node_modules/b/server/x.ts')).toBe(false)
    expect(re.test('/proj/node_modules/a/node_modules/other/x.ts')).toBe(true)
    expect(re.test('/proj/node_modules/other/x.ts')).toBe(true)
  })

  it('does not exclude files belonging to a layer installed via pnpm', () => {
    const re = getLayerNodeModulesExcludePattern([
      '/proj/node_modules/.pnpm/foo@1/node_modules/foo/',
    ])
    expect(re.test('/proj/node_modules/.pnpm/foo@1/node_modules/foo/server/x.ts')).toBe(false)
    expect(re.test('/proj/node_modules/.pnpm/other@1/node_modules/other/x.ts')).toBe(true)
    expect(re.test('/proj/node_modules/other/x.ts')).toBe(true)
  })

  it('protects every node_modules boundary in a pnpm layer path', () => {
    const re = getLayerNodeModulesExcludePattern([
      '/proj/node_modules/.pnpm/foo@1/node_modules/foo/',
    ])
    expect(re.source).toContain('.pnpm')
  })

  it('handles multiple pnpm-installed layers', () => {
    const re = getLayerNodeModulesExcludePattern([
      '/proj/node_modules/.pnpm/foo@1/node_modules/foo/',
      '/proj/node_modules/.pnpm/bar@1/node_modules/bar/',
    ])
    expect(re.test('/proj/node_modules/.pnpm/foo@1/node_modules/foo/server/x.ts')).toBe(false)
    expect(re.test('/proj/node_modules/.pnpm/bar@1/node_modules/bar/server/x.ts')).toBe(false)
    expect(re.test('/proj/node_modules/.pnpm/baz@1/node_modules/baz/x.ts')).toBe(true)
  })

  it('escapes regex metacharacters in package names', () => {
    const re = getLayerNodeModulesExcludePattern(['/proj/node_modules/@scope/foo.bar/'])
    expect(re.test('/proj/node_modules/@scope/foo.bar/server/x.ts')).toBe(false)
    expect(re.test('/proj/node_modules/@scope/fooxbar/server/x.ts')).toBe(true)
  })

  it('strips a trailing slash on the layer root before walking', () => {
    const withSlash = getLayerNodeModulesExcludePattern(['/proj/node_modules/foo/'])
    const withoutSlash = getLayerNodeModulesExcludePattern(['/proj/node_modules/foo'])
    expect(withSlash.source).toBe(withoutSlash.source)
  })
})

describe('toFsDriverIgnorePatterns', () => {
  const base = '/app'

  it('matches slashless patterns at any depth, and a file by name alone', () => {
    expect(toFsDriverIgnorePatterns(['*.log', 'node_modules'], base)).toEqual(['**/*.log', '**/node_modules'])
    expect(matchesGlob('/app/nested/file.log', '**/*.log')).toBe(true)
    expect(matchesGlob('file.log', '**/*.log')).toBe(true)
  })

  it('resolves patterns containing a slash against the mount base', () => {
    expect(toFsDriverIgnorePatterns(['app/middleware/*.js', '**/*.spec.ts'], base)).toEqual(['/app/app/middleware/*.js', '**/*.spec.ts'])
    expect(matchesGlob('/app/nested/app/middleware/x.js', '/app/app/middleware/*.js')).toBe(false)
  })

  it('strips the leading and trailing slashes of anchored and directory-only patterns', () => {
    expect(toFsDriverIgnorePatterns(['/vendor', 'build/', '/packages/a/'], base)).toEqual(['/app/vendor', '**/build', '/app/packages/a'])
    expect(matchesGlob('/app/nested/packages/a', '/app/packages/a')).toBe(false)
  })

  it('drops patterns resolved outside the mount base', () => {
    expect(toFsDriverIgnorePatterns(['../.nuxt', '.nuxt'], base)).toEqual(['**/.nuxt'])
  })

  it('drops patterns a negated pattern would re-include', () => {
    expect(toFsDriverIgnorePatterns(['app/middleware/foo/*.js', '!app/middleware/foo/bar.js'], base)).toEqual([])
    expect(toFsDriverIgnorePatterns(['*.log', '!important.log'], base)).toEqual([])
    expect(toFsDriverIgnorePatterns(['*.log', '**/.output', '!important.log'], base)).toEqual(['**/.output'])
  })

  it('drops a pattern re-included by a more general negated pattern', () => {
    expect(toFsDriverIgnorePatterns(['app/middleware/foo/bar.js', '!app/middleware/foo/*.js'], base)).toEqual([])
    expect(toFsDriverIgnorePatterns(['app/middleware/foo/bar.js', '!**/*.js'], base)).toEqual([])
  })

  it('keeps a pattern declared after the negated pattern it overlaps', () => {
    expect(toFsDriverIgnorePatterns(['!important.log', '*.log'], base)).toEqual(['**/*.log'])
    expect(toFsDriverIgnorePatterns(['*.log', '!important.log', '**/*.log'], base)).toEqual(['**/*.log'])
  })
})
