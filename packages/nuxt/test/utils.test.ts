import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { isDirectory, isDirectorySync, linkToAlias, offsetToPosition } from '../src/utils.ts'

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

describe('isDirectory', () => {
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

  it('returns true for an existing directory', async () => {
    expect(await isDirectory(dir)).toBe(true)
  })

  it('returns false for an existing file', async () => {
    expect(await isDirectory(file)).toBe(false)
  })

  it('returns false for a non-existent path (ENOENT)', async () => {
    expect(await isDirectory(join(dir, 'nope'))).toBe(false)
  })

  it('returns false when a path segment is a file, not a directory (ENOTDIR)', async () => {
    expect(await isDirectory(join(file, 'child'))).toBe(false)
  })
})

describe('offsetToPosition', () => {
  const code = 'first\nsecond\nthird'

  it('returns a 1-based line and column', () => {
    expect(offsetToPosition(code, 0)).toEqual({ line: 1, column: 1 })
    expect(offsetToPosition(code, 6)).toEqual({ line: 2, column: 1 })
    expect(offsetToPosition(code, 9)).toEqual({ line: 2, column: 4 })
  })

  it('clamps an offset beyond the end of the code', () => {
    expect(offsetToPosition(code, code.length + 10)).toEqual({ line: 3, column: 6 })
  })
})

describe('linkToAlias', () => {
  it('labels a path with its cwd-relative form and position when there is no Nuxt instance', () => {
    expect(linkToAlias(join(process.cwd(), 'app/pages/index.vue'), null, { line: 2, column: 4 })).toBe('app/pages/index.vue:2:4')
  })

  it('strips a module query', () => {
    expect(linkToAlias(join(process.cwd(), 'app/pages/index.vue?macro=true'), null)).toBe('app/pages/index.vue')
  })
})
