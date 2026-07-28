import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import { DecoratorsPlugin, hasDecoratorSyntax } from '../src/plugins/decorators'

function matchesFilter (
  filter: {
    code?: string
    id?: {
      include?: RegExp[]
      exclude?: RegExp[]
    }
  },
  code: string,
  id: string,
) {
  if (filter.code && !code.includes(filter.code)) {
    return false
  }

  if (filter.id?.include?.length && !filter.id.include.some(re => re.test(id))) {
    return false
  }

  if (filter.id?.exclude?.some(re => re.test(id))) {
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
    code?: string
    id?: {
      include?: RegExp[]
      exclude?: RegExp[]
    }
  }

  it('matches TypeScript files containing decorator syntax', () => {
    expect(matchesFilter(filter, '@sealed class A {}', '/src/example.ts')).toBe(true)
  })

  it('does not match CSS files', () => {
    expect(matchesFilter(filter, '@import "./base.css";', '/src/styles.css')).toBe(false)
    expect(matchesFilter(filter, '@import "./base.scss";', '/src/styles.scss')).toBe(false)
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
