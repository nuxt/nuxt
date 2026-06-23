import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { isDirectorySync } from '../src/utils.ts'

describe('isDirectorySync', () => {
  let dir: string
  let file: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'nuxt-isdir'))
    file = join(dir, 'testfile.txt')
    writeFileSync(file, '')
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns true for an existing directory', () => {
    expect(isDirectorySync(dir)).toBe(true)
  })

  it('returns false for an existing file', () => {
    expect(isDirectorySync(file)).toBe(false)
  })

  it('returns false for a non-existent path (ENOENT)', () => {
    expect(isDirectorySync(join(dir, 'nope'))).toBe(false)
  })

  it('returns false when a path segment is a file, not a directory (ENOTDIR)', () => {
    expect(isDirectorySync(join(file, 'child'))).toBe(false)
  })
})
