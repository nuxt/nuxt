import { describe, expect, it } from 'vitest'
import { ModulePreloadPolyfillPlugin } from '../../src/plugins/module-preload-polyfill.ts'

const ENTRY = '/repo/.nuxt/entry.mjs'
const transform = (code: string, id: string) =>
  (ModulePreloadPolyfillPlugin(ENTRY).transform as any).call({}, code, id)

describe('ModulePreloadPolyfillPlugin', () => {
  it('applies to the client environment only', () => {
    const plugin = ModulePreloadPolyfillPlugin(ENTRY)
    expect(plugin.name).toBe('nuxt:nasti:module-preload-polyfill')
    expect(plugin.applyToEnvironment?.({ name: 'client' } as any)).toBe(true)
    expect(plugin.applyToEnvironment?.({ name: 'ssr' } as any)).toBe(false)
  })

  it('prepends the polyfill to the client entry, preserving the original code', () => {
    const out = transform('export default 1', ENTRY)
    expect(out?.code).toContain('modulepreload')
    expect(out?.code.endsWith('export default 1')).toBe(true)
    expect(out?.map).toBeTruthy()
  })

  it('matches the entry even with a query suffix', () => {
    const out = transform('export default 1', ENTRY + '?v=abc123')
    expect(out?.code).toContain('modulepreload')
  })

  it('leaves other modules untouched', () => {
    expect(transform('export default 1', '/repo/.nuxt/other.mjs')).toBeUndefined()
  })
})
