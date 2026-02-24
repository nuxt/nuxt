import { describe, expect, it, vi } from 'vitest'

import { logger, useLogger } from './logger.ts'

describe('logger', () => {
  it('should expose consola', () => {
    expect(logger).toBeDefined()
    expect(logger.create).toBeDefined()
    expect(logger.withTag).toBeDefined()
  })
})

describe('useLogger', () => {
  it('should expose logger when not passing a tag', () => {
    expect(useLogger()).toBe(logger)
  })

  it('should create a new instance when passing a tag', () => {
    const mockWithTag = vi.fn().mockReturnValue({})
    const mockInstance = { withTag: mockWithTag }
    const createSpy = vi.spyOn(logger, 'create').mockReturnValue(mockInstance as any)

    useLogger('tag')

    expect(createSpy).toHaveBeenCalledWith({})
    expect(mockWithTag).toHaveBeenCalledWith('tag')

    createSpy.mockRestore()
  })

  it('should create a new instance when passing a tag and options', () => {
    const mockWithTag = vi.fn().mockReturnValue({})
    const mockInstance = { withTag: mockWithTag }
    const createSpy = vi.spyOn(logger, 'create').mockReturnValue(mockInstance as any)

    useLogger('tag', { level: 0 })

    expect(createSpy).toHaveBeenCalledWith({ level: 0 })
    expect(mockWithTag).toHaveBeenCalledWith('tag')

    createSpy.mockRestore()
  })
})
