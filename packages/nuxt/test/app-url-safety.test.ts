import { describe, expect, it } from 'vitest'
import { getScriptProtocol, isAbsoluteHref, sanitizeAnchorHref } from '../src/app/utils.ts'

describe('isAbsoluteHref', () => {
  it.each([
    '',
    '/',
    '/foo/bar?a=1#b',
    '/foo:bar',
    '#hash',
    'foo',
    './foo',
    '../foo',
    'foo bar:baz',
  ])('should treat %j as relative', (value) => {
    expect(isAbsoluteHref(value)).toBe(false)
  })

  it.each([
    'https://example.com',
    'HTTP://example.com',
    'mailto:a@b.c',
    '//evil.com',
    '\\\\evil.com',
    '/\\evil.com',
    'javascript:alert(1)',
    '\u0001javascript:alert(1)',
    'java\tscript:alert(1)',
    'c:\\windows',
  ])('should treat %j as absolute', (value) => {
    expect(isAbsoluteHref(value)).toBe(true)
  })
})

describe('sanitizeAnchorHref', () => {
  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    '\u0001javascript:alert(1)',
    '\u0000javascript:alert(1)',
    '\tjavascript:alert(1)',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:alert(1)',
    'blob:https://example.com/x',
    'view-source:javascript:alert(1)',
    '\u0001view-source:\u0001javascript:alert(1)',
  ])('should reject %j', (value) => {
    expect(sanitizeAnchorHref(value)).toBeNull()
    expect(getScriptProtocol(value)).not.toBeNull()
  })

  it.each([
    '',
    '/foo/bar?a=1#b',
    '#hash',
    '/view-source:javascript:alert(1)',
    '%01javascript:alert(1)',
    'https://example.com',
    'mailto:a@b.c',
    'tel:123',
    'about:blank',
  ])('should allow %j', (value) => {
    expect(sanitizeAnchorHref(value)).toBe(value)
    expect(getScriptProtocol(value)).toBeNull()
  })
})
