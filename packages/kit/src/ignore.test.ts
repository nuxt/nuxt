import { expect, it, describe } from 'vitest'
import { resolveGroupSyntax } from './ignore.js'

describe('resolveGroupSyntax', () => {
  it('should resolve single group syntax', () => {
    expect(resolveGroupSyntax('**/*.{spec}.{js,ts}')).toStrictEqual([
      '**/*.spec.js',
      '**/*.spec.ts'
    ])
  })

  it('should resolve multi-group syntax', () => {
    expect(resolveGroupSyntax('**/*.{spec,test}.{js,ts}')).toStrictEqual([
      '**/*.spec.js',
      '**/*.spec.ts',
      '**/*.test.js',
      '**/*.test.ts'
    ])
  })

  it('should do nothing with normal globs', () => {
    expect(resolveGroupSyntax('**/*.spec.js')).toStrictEqual([
      '**/*.spec.js'
    ])
  })
})
