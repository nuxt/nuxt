import { describe, expect, it } from 'vitest'
import { toFsUrl } from './css.ts'

describe('toFsUrl', () => {
  it('should prefix a posix path', () => {
    expect(toFsUrl('/project/packages/nuxt/src/app/entry.async.ts')).toBe('/@fs/project/packages/nuxt/src/app/entry.async.ts')
  })

  it('should keep a separator before a windows drive letter', () => {
    expect(toFsUrl('D:/project/packages/nuxt/src/app/entry.async.ts')).toBe('/@fs/D:/project/packages/nuxt/src/app/entry.async.ts')
  })
})
