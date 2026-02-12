import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createViteLogger } from './logger.ts'
import { logger } from '@nuxt/kit'

vi.mock('@nuxt/kit', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    box: vi.fn(),
    level: 3,
  },
  useNitro: vi.fn(() => ({
    options: {
      publicAssets: [],
    },
  })),
}))

vi.mock('consola/utils', () => ({
  colorize: vi.fn((_color, text) => text),
}))

describe('createViteLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('should capture new dependencies and show a suggestion after debounce', () => {
    const config = {
      root: '/',
      build: { outDir: '/dist' },
      optimizeDeps: {
        include: ['existing-dep'],
      },
    }
    const viteLogger = createViteLogger(config as any)

    viteLogger.info('✨ new dependencies optimized: dep1, dep2')

    // Should not show immediately
    expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('Vite has discovered new dependencies'))

    // Fast-forward 2.5 seconds
    vi.advanceTimersByTime(2500)

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Vite has discovered new dependencies'))
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('\'dep1\','))
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('\'dep2\','))
    // Existing deps are included in the merged snippet
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('\'existing-dep\','))
  })

  it('should debounce multiple messages and reloads', () => {
    const config = { root: '/', build: { outDir: '/dist' }, optimizeDeps: { include: [] } }
    const viteLogger = createViteLogger(config as any)

    viteLogger.info('✨ new dependencies optimized: dep1')
    vi.advanceTimersByTime(1000)
    viteLogger.info('optimized dependencies changed. reloading')
    vi.advanceTimersByTime(2000)
    viteLogger.info('✨ new dependencies optimized: dep2')

    expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('Vite has discovered new dependencies'))

    vi.advanceTimersByTime(2500)
    expect(logger.info).toHaveBeenCalledTimes(4) // 3 original info logs + 1 suggestion
    const suggestion = vi.mocked(logger.info).mock.calls.find(call => (call[0] as string).includes('Vite has discovered new dependencies'))
    expect(suggestion?.[0]).toContain('\'dep1\',')
    expect(suggestion?.[0]).toContain('\'dep2\',')
  })

  it('should only show the hint once', () => {
    const config = { root: '/', build: { outDir: '/dist' }, optimizeDeps: { include: [] } }
    const viteLogger = createViteLogger(config as any)

    viteLogger.info('✨ new dependencies optimized: dep1')
    vi.advanceTimersByTime(2500)

    // Second discovery after hint already shown
    viteLogger.info('✨ new dependencies optimized: dep2')
    vi.advanceTimersByTime(2500)

    const hints = vi.mocked(logger.info).mock.calls.filter(call => (call[0] as string).includes('Vite has discovered new dependencies'))
    expect(hints).toHaveLength(1)
  })

  it('should reset suggestion state on clearScreen', () => {
    const config = { root: '/', build: { outDir: '/dist' }, optimizeDeps: { include: [] }, clearScreen: true } as any
    const viteLogger = createViteLogger(config)

    viteLogger.info('✨ new dependencies optimized: dep1')
    viteLogger.clearScreen('info')

    vi.advanceTimersByTime(2500)

    // Suggestion should not fire after clearScreen
    expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('Vite has discovered new dependencies'))
  })
})
