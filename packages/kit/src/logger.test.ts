import { describe, expect, it, vi } from 'vitest'

import { consola } from 'consola'
import { logger, useLogger } from './logger'

vi.mock("consola", () => {
  const logger = {} as any;

  logger.create = vi.fn(() => ({...logger}));
  logger.withTag = vi.fn(() => ({...logger}));
  
  return { consola: logger };
})

describe('logger', () => {
  it('should expose consola', () => {
    expect(logger).toBe(consola)
  })
})

describe('useLogger', () => {
  it('should expose consola when not passing a tag', () => {
    expect(useLogger()).toBe(consola);
  });

  it('should create a new instance when passing a tag', () => {
    const logger = vi.mocked(consola);
    
    const instance = useLogger("tag");

    expect(instance).toEqual(logger);
    expect(instance).not.toBe(logger);
    expect(logger.create).toBeCalledWith({});
    expect(logger.withTag).toBeCalledWith("tag");
  });

  it('should create a new instance when passing a tag and options', () => {
    const logger = vi.mocked(consola);
    
    const instance = useLogger("tag", { level: 0 });

    expect(instance).toEqual(logger);
    expect(instance).not.toBe(logger);
    expect(logger.create).toBeCalledWith({ level: 0 });
    expect(logger.withTag).toBeCalledWith("tag");
  });

})
