import { describe, expect, it, vi } from 'vitest'
import { colorize } from 'consola/utils'
import { createViteLogger } from '../src/utils/logger.ts'

vi.mock('@nuxt/kit', () => {
  return {
    logger: { level: 3, info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    tryUseNitro: () => undefined,
  }
})

const { logger } = await import('@nuxt/kit')

describe('createViteLogger', () => {
  // https://github.com/nuxt/nuxt/issues/36497
  it.each([
    ['dependency optimized: qrcode', ['qrcode']],
    ['dependencies optimized: qrcode, @scope/pkg', ['qrcode', '@scope/pkg']],
    // Vite < 8.1.1
    ['✨ new dependencies optimized: qrcode', ['qrcode']],
  ])('reports runtime-discovered deps from "%s"', (msg, deps) => {
    const onNewDeps = vi.fn()
    const viteLogger = createViteLogger({ root: '/project', build: { outDir: '/project/dist' } }, { onNewDeps })

    viteLogger.info(colorize('green', msg), { timestamp: true })

    expect(onNewDeps).toHaveBeenCalledWith(deps)
    expect(logger.info).not.toHaveBeenCalled()
  })
})
