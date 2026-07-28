import { describe, expect, it } from 'vitest'
import { stripInvalidPureAnnotations } from '../src/plugins/strip-invalid-pure-annotations'

describe('stripInvalidPureAnnotations', () => {
  it('strips the orphan annotation that webpack and rspack leave on unused-export stubs', () => {
    const input = 'const LayoutMetaSymbol = /* @__PURE__ */ (/* unused pure expression or super */ null && (Symbol("layout-meta")));'
    const out = stripInvalidPureAnnotations(input)
    expect(out).not.toContain('/* @__PURE__ */ (/* unused pure expression or super */')
    expect(out).toContain('(/* unused pure expression or super */ null && (Symbol("layout-meta")))')
    expect(out.length).toBe(input.length)
  })

  it('leaves stubs without a leading annotation untouched', () => {
    const input = 'const definePayloadPlugin = (/* unused pure expression or super */ null && (defineNuxtPlugin));'
    expect(stripInvalidPureAnnotations(input)).toBe(input)
  })

  it('leaves legitimate /* @__PURE__ */ annotations untouched', () => {
    const input = 'const x = /* @__PURE__ */ foo(); const y = /* @__PURE__ */ new Bar();'
    expect(stripInvalidPureAnnotations(input)).toBe(input)
  })

  it('returns the input as-is when no stub marker is present', () => {
    const input = 'console.log("nothing to do here")'
    expect(stripInvalidPureAnnotations(input)).toBe(input)
  })
})
