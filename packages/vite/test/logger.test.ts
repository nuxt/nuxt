import { describe, expect, it, vi } from 'vitest'
import { colors } from 'consola/utils'
import { createViteLogger } from '../src/utils/logger.ts'

vi.mock('@nuxt/kit', () => ({
  logger: { level: 3, info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  tryUseNitro: () => undefined,
}))

const { logger } = await import('@nuxt/kit')

function setup () {
  const onNewDeps = vi.fn()
  const viteLogger = createViteLogger({ root: '/project', build: { outDir: '/project/dist' } }, { onNewDeps })
  vi.mocked(logger.info).mockClear()
  return { viteLogger, onNewDeps }
}

describe('createViteLogger', () => {
  it.each([
    ['dependency optimized: ', ['qrcode']],
    ['dependencies optimized: ', ['qrcode', 'lodash']],
  ])('should report runtime-discovered deps from `%s`', (prefix, deps) => {
    const { viteLogger, onNewDeps } = setup()
    viteLogger.info(colors.green(`${prefix}${colors.yellow(deps.join(', '))}`), { timestamp: true })
    expect(onNewDeps).toHaveBeenCalledWith(deps)
    expect(logger.info).not.toHaveBeenCalled()
  })

  it('should hide optimizer messages covered by the hint', () => {
    const { viteLogger } = setup()
    viteLogger.info(colors.green('optimized dependencies changed. reloading'), { timestamp: true })
    viteLogger.info(
      colors.magenta(`tip: consider adding ${colors.yellow('qrcode')} to optimizeDeps.include to speed up cold start`)
      + colors.dim('\n  See https://vite.dev/guide/dep-pre-bundling.html#customizing-the-behavior'),
      { timestamp: true },
    )
    expect(logger.info).not.toHaveBeenCalled()
  })
})
