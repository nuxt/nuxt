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

  it('strips the orphan annotation that webpack and rspack leave on a call removed from a dead branch', () => {
    const input = 'const d = true ? /* @__PURE__ */ (0,prod)({ a: 1 }) : /* @__PURE__ */ 0;'
    const out = stripInvalidPureAnnotations(input)
    expect(out).toBe(`const d = true ? /* @__PURE__ */ (0,prod)({ a: 1 }) : ${' '.repeat(15)} 0;`)
  })

  it.each([
    ['false && /*@__PURE__*/ 0;', `false && ${' '.repeat(13)} 0;`],
    ['false && /*#__PURE__*/ 0;', `false && ${' '.repeat(13)} 0;`],
    [
      'const diagnostics = /*#__PURE__*/ (/* unused pure expression or super */ null && (defineDiagnostics({})));',
      `const diagnostics = ${' '.repeat(13)} (/* unused pure expression or super */ null && (defineDiagnostics({})));`,
    ],
  ])('strips a compact annotation carried over from library source (%s)', (input, output) => {
    expect(stripInvalidPureAnnotations(input)).toBe(output)
  })

  it('leaves stubs without a leading annotation untouched', () => {
    const input = 'const definePayloadPlugin = (/* unused pure expression or super */ null && (defineNuxtPlugin));'
    expect(stripInvalidPureAnnotations(input)).toBe(input)
  })

  it('leaves legitimate /* @__PURE__ */ annotations untouched', () => {
    const input = 'const x = /* @__PURE__ */ foo(); const y = /*#__PURE__*/ new Bar(); const z = /*@__PURE__*/ (0, baz)();'
    expect(stripInvalidPureAnnotations(input)).toBe(input)
  })

  it('returns the input as-is when no stub marker is present', () => {
    const input = 'console.log("nothing to do here")'
    expect(stripInvalidPureAnnotations(input)).toBe(input)
  })
})
