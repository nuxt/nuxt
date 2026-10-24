import { describe, expect, it } from 'vitest'

import { resolvePackageDir, resolvePackageJSON } from '../src/internal/package-json.ts'

describe('resolvePackageJSON', () => {
  it('resolves the manifest of an installed package', () => {
    // TODO: drop `(?:-nightly)?` once the catalog uses the published nitro RC
    expect(resolvePackageJSON('nitro', { from: import.meta.url })).toMatch(/nitro(?:-nightly)?[\\/]package\.json$/)
  })

  it('returns `undefined` for an unresolvable module id when `try` is set', () => {
    expect(resolvePackageJSON('@nuxt/definitely-not-installed', { from: import.meta.url, try: true })).toBeUndefined()
    expect(resolvePackageDir('@nuxt/definitely-not-installed', { from: import.meta.url, try: true })).toBeUndefined()
    expect(resolvePackageJSON('nitro', { from: '/nonexistent-root/index.js', try: true })).toBeUndefined()
  })

  it('throws for an unresolvable module id without `try`', () => {
    expect(() => resolvePackageJSON('@nuxt/definitely-not-installed', { from: import.meta.url })).toThrow()
  })
})
