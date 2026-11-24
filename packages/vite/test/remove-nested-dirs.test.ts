import { describe, expect, it } from 'vitest'

import { removeNestedDirs } from '../src/utils/index.ts'

describe('removeNestedDirs', () => {
  it('removes duplicates and keeps the first-seen order', () => {
    expect(removeNestedDirs(['/b', '/a', '/b', '/c', '/a'])).toEqual(['/b', '/a', '/c'])
  })

  it('removes dirs nested inside another entry', () => {
    expect(removeNestedDirs([
      '/app/components/deep',
      '/app',
      '/app/components',
      '/other/plugins',
    ])).toEqual(['/app', '/other/plugins'])
  })

  it('keeps sibling dirs that only share a name prefix', () => {
    expect(removeNestedDirs(['/app', '/app-layer/components', '/app/components'])).toEqual(['/app', '/app-layer/components'])
  })

  it('ignores empty entries', () => {
    expect(removeNestedDirs(['', '/app', '/other/plugins'])).toEqual(['/app', '/other/plugins'])
  })

  it('only treats an entry as a parent when the next character is a slash', () => {
    expect(removeNestedDirs(['/layer/', '/layer/components', '/layer/components'])).toEqual(['/layer/', '/layer/components'])
  })
})
