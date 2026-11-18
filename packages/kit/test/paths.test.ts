import { describe, expect, it } from 'vitest'

import { isWithinDir } from '../src/internal/paths.ts'

describe('isWithinDir', () => {
  it.each(['/project/layer', '/project/layer/'])('matches the directory itself and files inside `%s`', (dir) => {
    expect(isWithinDir('/project/layer', dir)).toBe(true)
    expect(isWithinDir('/project/layer/', dir)).toBe(true)
    expect(isWithinDir('/project/layer/app/pages/index.vue', dir)).toBe(true)
  })

  it.each(['/project/layer', '/project/layer/'])('does not match siblings sharing a name prefix with `%s`', (dir) => {
    expect(isWithinDir('/project/layer-utils', dir)).toBe(false)
    expect(isWithinDir('/project/layer-utils/index.ts', dir)).toBe(false)
    expect(isWithinDir('/project/layer.ts', dir)).toBe(false)
  })

  it.each(['/project/layer', '/project/layer/'])('does not match parents of `%s`', (dir) => {
    expect(isWithinDir('/project', dir)).toBe(false)
    expect(isWithinDir('/project/', dir)).toBe(false)
    expect(isWithinDir('/project/lay', dir)).toBe(false)
  })

  it('matches every absolute path within the filesystem root', () => {
    expect(isWithinDir('/', '/')).toBe(true)
    expect(isWithinDir('/project/index.ts', '/')).toBe(true)
  })

  it('matches windows drive paths', () => {
    expect(isWithinDir('C:/project/layer/index.ts', 'C:/project/layer')).toBe(true)
    expect(isWithinDir('C:/project/layer-utils/index.ts', 'C:/project/layer')).toBe(false)
  })
})
