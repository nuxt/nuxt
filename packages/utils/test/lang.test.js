import {
  encodeHtml, isString, isNonEmptyString,
  isPureObject, isUrl, urlJoin, wrapArray, stripWhitespace
} from '../src/lang'

describe('util: lang', () => {
  test('should check if given argument is string', () => {
    expect(isString('str')).toEqual(true)
    expect(isString(String(100))).toEqual(true)
    expect(isString(100)).toEqual(false)
    expect(isString([])).toEqual(false)
  })

  test('should check if given argument is empty string', () => {
    expect(isNonEmptyString('str')).toEqual(true)
    expect(isNonEmptyString([])).toEqual(false)
    expect(isNonEmptyString('')).toEqual(false)
  })

  test('should check if given argument is pure object', () => {
    expect(isPureObject({})).toEqual(true)
    expect(isPureObject([])).toEqual(false)
    expect(isPureObject(Number('1'))).toEqual(false)
  })

  test('should check if given argument is url', () => {
    expect(isUrl('http://localhost')).toEqual(true)
    expect(isUrl('https://localhost')).toEqual(true)
    expect(isUrl('//localhost')).toEqual(true)
    expect(isUrl('localhost')).toEqual(false)
  })

  test('should wrap given argument with array', () => {
    expect(wrapArray(['array'])).toEqual(['array'])
    expect(wrapArray('str')).toEqual(['str'])
  })

  test('should strip white spaces in given argument', () => {
    expect(stripWhitespace('foo')).toEqual('foo')
    expect(stripWhitespace('foo\t\r\f\n')).toEqual('foo\n')
    expect(stripWhitespace('foo{\n\n\n')).toEqual('foo{\n')
    expect(stripWhitespace('\n\n\n\f\r\f}')).toEqual('\n\f\r\f}')
    expect(stripWhitespace('foo\n\n\nbar')).toEqual('foo\n\nbar')
    expect(stripWhitespace('foo\n\n\n')).toEqual('foo\n')
  })

  test('should encode html', () => {
    const html = '<h1>Hello</h1>'
    expect(encodeHtml(html)).toEqual('&lt;h1&gt;Hello&lt;/h1&gt;')
  })

  test('should join url', () => {
    expect(urlJoin('test', '/about')).toEqual('test/about')
  })
})
