import { describe, expect, it } from 'vitest'
import { RuntimePathsPlugin } from '../../src/plugins/runtime-paths.ts'

const transform = (code: string, id: string) =>
  (RuntimePathsPlugin().transform as any).call({}, code, id)

describe('RuntimePathsPlugin', () => {
  it('runs post, on the client environment only', () => {
    const plugin = RuntimePathsPlugin()
    expect(plugin.name).toBe('nuxt:nasti:runtime-paths')
    expect(plugin.enforce).toBe('post')
    expect(plugin.applyToEnvironment?.({ name: 'client' } as any)).toBe(true)
    expect(plugin.applyToEnvironment?.({ name: 'ssr' } as any)).toBe(false)
  })

  it('prepends the paths import when an asset placeholder is present', () => {
    const out = transform('export const a = "__NASTI_ASSET__abc"', 'comp.mjs')
    expect(out?.code.startsWith('import "#internal/nuxt/paths";\n')).toBe(true)
    expect(out?.map).toBeTruthy()
  })

  it('also matches the public-asset placeholder', () => {
    const out = transform('const u = __NASTI_PUBLIC_ASSET__', 'comp.mjs')
    expect(out?.code).toContain('import "#internal/nuxt/paths";')
  })

  it('ignores modules without an asset placeholder', () => {
    expect(transform('export const a = 1', 'comp.mjs')).toBeUndefined()
  })

  it('skips CSS modules', () => {
    expect(transform('a{background:url(__NASTI_ASSET__x)}', 'styles.css')).toBeUndefined()
    expect(transform('a{background:url(__NASTI_ASSET__x)}', 'styles.scss')).toBeUndefined()
  })

  it('skips Vue <style> blocks', () => {
    expect(transform('.a{color:__NASTI_ASSET__}', 'Comp.vue?vue&type=style&index=0&lang.css')).toBeUndefined()
  })
})
