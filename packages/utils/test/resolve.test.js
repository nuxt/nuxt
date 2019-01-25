import path from 'path'

import {
  startsWithAlias, startsWithSrcAlias, isWindows, wp, wChunk,
  r, relativeTo, defineAlias, isIndexFileAndFolder, getMainModule
} from '../src/resolve'

describe('util: resolve', () => {
  describe('relativeTo', () => {
    const path1 = path.join(path.sep, 'foo', 'bar')
    const path2 = path.join(path.sep, 'foo', 'baz')

    test('makes path relative to dir', () => {
      expect(relativeTo(path1, path2)).toBe(wp(`..${path.sep}baz`))
    })

    test('keeps webpack inline loaders prepended', () => {
      expect(relativeTo(path1, `loader1!loader2!${path2}`))
        .toBe(wp(`loader1!loader2!..${path.sep}baz`))
    })
  })
})
