import path from 'upath'
import pify from 'pify'
import { Volume, createFsFromVolume } from 'memfs'

import type { IFs } from 'memfs'

export function createMFS () {
  // Create a new volume
  const fs = createFsFromVolume(new Volume())

  // Clone to extend
  const _fs : Partial<IFs> & { join?(...paths: string[]): string } = { ...fs }

  // fs.join method is (still) expected by webpack-dev-middleware
  // There might be differences with https://github.com/webpack/memory-fs/blob/master/lib/join.js
  _fs.join = path.join

  // Used by vue-renderer
  _fs.exists = p => Promise.resolve(_fs.existsSync(p))
  _fs.readFile = pify(_fs.readFile)

  return _fs
}
