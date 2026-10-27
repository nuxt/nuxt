import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import { DecoratorsPlugin, hasDecoratorSyntax } from '../src/plugins/decorators'

function matchesFilter (
  filter: {
    code?: RegExp
    id?: {
      include?: RegExp[]
      exclude?: RegExp | RegExp[]
    }
  },
  code: string,
  id: string,
) {
  if (filter.code && !filter.code.test(code)) {
    return false
  }

  if (filter.id?.exclude && [filter.id.exclude].flat().some(re => re.test(id))) {
    return false
  }

  if (filter.id?.include?.length && !filter.id.include.some(re => re.test(id))) {
    return false
  }

  return true
}

describe('DecoratorsPlugin transform filter', () => {
  const nuxt = {
    options: {
      experimental: { decorators: true } as Nuxt['options']['experimental'],
      rootDir: '/tmp',
      modulesDir: [],
    },
  }

  // @ts-expect-error - we only need nuxt.options.experimental.decorators, rootDir, and modulesDir for this test
  const plugin = DecoratorsPlugin(nuxt as Nuxt)

  if (typeof plugin.transform !== 'object' || !plugin.transform?.filter) {
    throw new Error('Expected object-based transform with filter')
  }

  const filter = plugin.transform.filter as {
    code?: RegExp
    id?: {
      include?: RegExp[]
      exclude?: RegExp | RegExp[]
    }
  }

  it('matches TypeScript files containing decorator syntax', () => {
    expect(matchesFilter(filter, '@sealed class A {}', '/src/example.ts')).toBe(true)
  })

  it('does not match CSS files', () => {
    expect(matchesFilter(filter, '@import "./base.css";', '/src/styles.css')).toBe(false)
    expect(matchesFilter(filter, '@import "./base.scss";', '/src/styles.scss')).toBe(false)
  })

  it.each([
    '@sealed class Example {}',
    'class Example { @logged method () {} }',
    'const Example = @sealed class {}',
    'x / @sealed class C {}',
    'x * @sealed class C {}',
    'x *@sealed class C {}',
    'const r = [...@sealed class C {}]',
    'f(...@sealed class C {})',
    'f(@sealed class C {})',
    'new (@sealed class C {})()',
    '@(sealed) class C {}',
    '@\\u0073ealed class C {}',
    'if (x) {}@sealed class C {}',
    'x = cond ? @sealed class C {} : null',
    'const s = "//"; @sealed class C {}',
    'const s = "/*"; @sealed class C {}',
    'const s = "a/b"; @sealed class C {}',
    'export@sealed class C {}',
    'export @sealed class C {}',
    'export default@sealed class C {}',
    '@sealed export class C {}',
    '@ sealed class C {}',
    '@/* comment */sealed class C {}',
    'function f () { return@sealed class C {} }',
    'do {} while (false)@sealed class C {}',
    'const C = /x/*@sealed class {}',
    'x / @sealed @frozen class C {}',
    '// note *\n@sealed class C {}',
    '@sealed//comment\nclass C {}',
    'class C { /* note */@logged method () {} }',
    'class C { @logged "method" () {} }',
    'class C { @logged *#method () {} }',
    'class C { @logged * .5 () {} }',
    'class C { @logged *//comment\nmethod () {} }',
    'class C { @logged \u{1D465} = 1 }',
  ])('matches possible decorator in %s', (code) => {
    expect(matchesFilter(filter, code, '/src/example.ts')).toBe(true)
  })

  it.each([
    'import value from "@scope/package"',
    'const value = "@scope/package"',
    'import { foo } from \'@vue/shared\'',
    'const x = /*@__PURE__*/ foo()',
    'const x = /* @__PURE__ */ foo()',
    '// @__NO_SIDE_EFFECTS__\nfunction foo () {}',
    '//@ts-ignore\nconst x = 1',
    '// @ts-expect-error\nconst x = 1',
    '/**\n * @param {string} name\n * @returns the value\n */',
    '/** @deprecated use bar */',
  ])('does not match non-decorator at signs in %s', (code) => {
    expect(matchesFilter(filter, code, '/src/example.ts')).toBe(false)
  })
})

describe('hasDecoratorSyntax', () => {
  it.each([
    '@sealed class Example {}',
    'class Example { @logged method () {} }',
    'const Example = @sealed class {}',
    'const value = `${@sealed class {}}`',
    'const pattern = /\'/; @sealed class Example {}',
    'const pattern = /[`"\']/; @sealed class Example {}',
    'const pattern = /contact@example\\.com/; @sealed class Example {}',
    String.raw`const pattern = /https?:\/\/example\.com\/\/*/; @sealed class Example {}`,
    'if (value) /[\'"]/.test(value)\n@sealed class Example {}',
    'const ratio = left / right / divisor\n@sealed class Example {}',
    'class Example { #pattern = /\'/; @logged method () {} }',
    'const value = source?.property ?? /\'/\n@sealed class Example {}',
    'const value = `outer@text${`inner${@sealed class {}}`}`',
    'foo! / bar; @sealed class Example { value = /x/ }',
  ])('detects decorators in %s', (code) => {
    expect(hasDecoratorSyntax(code)).toBe(true)
  })

  it.each([
    'import value from "@scope/package"',
    '// @ts-expect-error\nconst value = true',
    '/* @deprecated */\nconst value = true',
    'const value = "@scope/package"',
    'const value = `contact@example.com`',
    'const value = `contact@${domain}`',
    '#!/usr/bin/env node\nconst value = true // contact@example.com',
  ])('ignores non-decorator usage in %s', (code) => {
    expect(hasDecoratorSyntax(code)).toBe(false)
  })

  it.each([
    'const value = /@scope\\/package/',
    'const value = /[`"\'@]/',
    String.raw`const value = /https?:\/\/user@example\.com\/\/*/`,
  ])('conservatively checks regular expressions containing at signs in %s', (code) => {
    expect(hasDecoratorSyntax(code)).toBe(true)
  })

  it('handles decorators and non-decorator at signs in JSX', () => {
    expect(hasDecoratorSyntax('const value = <p title="contact@example.com" />', true)).toBe(false)
    expect(hasDecoratorSyntax('const value = <p>contact@example.com</p>', true)).toBe(true)
    expect(hasDecoratorSyntax('const value = <p>{@sealed class Example {}}</p>', true)).toBe(true)
  })

  it('does not hide decorators after ambiguous TSX syntax', () => {
    expect(hasDecoratorSyntax('const identity = <T,>(value: T) => value\n@sealed class Example {}', true)).toBe(true)
  })

  it('conservatively handles unclosed literals', () => {
    expect(hasDecoratorSyntax('const value = "contact@example.com')).toBe(true)
    expect(hasDecoratorSyntax('const value = /contact@example.com')).toBe(true)
    expect(hasDecoratorSyntax('const value = `contact@example.com')).toBe(true)
    expect(hasDecoratorSyntax('/* contact@example.com')).toBe(true)
  })
})
