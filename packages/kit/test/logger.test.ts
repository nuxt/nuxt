import { describe, expect, it, vi } from 'vitest'

import { logger, useLogger } from '../src/logger.ts'

describe('useLogger', () => {
  it('should expose logger when not passing a tag', () => {
    expect(useLogger()).toBe(logger)
  })

  it.each([
    [undefined, {}],
    [{ level: 0 }, { level: 0 }],
  ])('should create a tagged instance with options %j', (options, expected) => {
    const withTag = vi.fn().mockReturnValue({})
    const create = vi.spyOn(logger, 'create').mockReturnValue({ withTag } as any)

    useLogger('tag', options)

    expect(create).toHaveBeenCalledWith(expected)
    expect(withTag).toHaveBeenCalledWith('tag')
    create.mockRestore()
  })
})
