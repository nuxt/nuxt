import { describe, expect, it } from 'vitest'
import { getLayerNodeModulesExcludePattern } from './utils.ts'

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
