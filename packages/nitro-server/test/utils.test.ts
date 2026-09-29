import { matchesGlob } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getLayerNodeModulesExcludePattern, toFsDriverIgnorePatterns, toModulePackageDir } from '../src/utils.ts'

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
  it('matches slashless patterns at any depth', () => {
    expect(toFsDriverIgnorePatterns(['*.log', 'node_modules'])).toEqual(['**/*.log', '**/node_modules'])
    expect(matchesGlob('nested/file.log', '**/*.log')).toBe(true)
  })

  it('keeps patterns containing a slash anchored to the mount base', () => {
    expect(toFsDriverIgnorePatterns(['app/middleware/*.js', '**/*.spec.ts'])).toEqual(['app/middleware/*.js', '**/*.spec.ts'])
    expect(matchesGlob('nested/app/middleware/x.js', 'app/middleware/*.js')).toBe(false)
  })

  it('strips the leading and trailing slashes of anchored and directory-only patterns', () => {
    expect(toFsDriverIgnorePatterns(['/vendor', 'build/', '/packages/a/'])).toEqual(['vendor', '**/build', 'packages/a'])
    expect(matchesGlob('nested/vendor', 'vendor')).toBe(false)
  })

  it('drops patterns resolved outside the mount base', () => {
    expect(toFsDriverIgnorePatterns(['../.nuxt', '.nuxt'])).toEqual(['**/.nuxt'])
  })

  it('drops patterns a negated pattern would re-include', () => {
    expect(toFsDriverIgnorePatterns(['app/middleware/foo/*.js', '!app/middleware/foo/bar.js'])).toEqual([])
    expect(toFsDriverIgnorePatterns(['*.log', '!important.log'])).toEqual([])
    expect(toFsDriverIgnorePatterns(['*.log', '**/.output', '!important.log'])).toEqual(['**/.output'])
  })

  it('drops a pattern re-included by a more general negated pattern', () => {
    expect(toFsDriverIgnorePatterns(['app/middleware/foo/bar.js', '!app/middleware/foo/*.js'])).toEqual([])
    expect(toFsDriverIgnorePatterns(['app/middleware/foo/bar.js', '!**/*.js'])).toEqual([])
  })

  it('keeps a pattern declared after the negated pattern it overlaps', () => {
    expect(toFsDriverIgnorePatterns(['!important.log', '*.log'])).toEqual(['**/*.log'])
    expect(toFsDriverIgnorePatterns(['*.log', '!important.log', '**/*.log'])).toEqual(['**/*.log'])
  })
})

describe('toModulePackageDir', () => {
  it('recovers the package directory of a pnpm-installed module', () => {
    expect(toModulePackageDir(
      '/proj/node_modules/.pnpm/nuxt-proxy@0.4.1/node_modules/',
      '/proj/node_modules/.pnpm/nuxt-proxy@0.4.1/node_modules/nuxt-proxy/dist',
    )).toBe('/proj/node_modules/.pnpm/nuxt-proxy@0.4.1/node_modules/nuxt-proxy')
  })

  it('keeps the scope of a scoped package', () => {
    expect(toModulePackageDir(
      '/proj/node_modules/',
      '/proj/node_modules/@nuxtjs/color-mode/dist',
    )).toBe('/proj/node_modules/@nuxtjs/color-mode')
  })

  it('leaves an in-project module directory alone', () => {
    expect(toModulePackageDir('/proj/modules/local', '/proj/modules/local')).toBe('/proj/modules/local')
  })

  it('takes the package from the entry path when the module resolved through a symlink', () => {
    expect(toModulePackageDir(
      '/proj/node_modules/.pnpm/nuxt-proxy@0.4.1/node_modules/',
      '/proj/test/fixtures/app/node_modules/nuxt-proxy/dist',
    )).toBe('/proj/test/fixtures/app/node_modules/nuxt-proxy')
  })

  it('names the package from a bare module specifier', () => {
    expect(toModulePackageDir(
      '/proj/node_modules/.pnpm/nuxt-proxy@0.4.1/node_modules/',
      'nuxt-proxy',
    )).toBe('/proj/node_modules/.pnpm/nuxt-proxy@0.4.1/node_modules/nuxt-proxy')
    expect(toModulePackageDir('/proj/node_modules/', '@nuxt/telemetry')).toBe('/proj/node_modules/@nuxt/telemetry')
  })

  it('falls back to the entry for an absolute entry outside any node_modules', () => {
    // never the bare `node_modules` it resolved from: as a prefix that would take in
    // every other package installed beside the module
    expect(toModulePackageDir('/proj/node_modules/', '/elsewhere/dist')).toBe('/elsewhere/dist')
  })
})
