import {
  encodeHtml, isString, isNonEmptyString,
  isPureObject, isUrl, urlJoin, wrapArray, stripWhitespace
} from '../src/lang'

describe('util: lang', () => {
  test('encodeHtml', () => {
    const html = '<h1>Hello</h1>'
    expect(encodeHtml(html)).toBe('&lt;h1&gt;Hello&lt;/h1&gt;')
  })

  test('urlJoin', () => {
    expect(urlJoin('test', '/about')).toBe('test/about')
  })
})
