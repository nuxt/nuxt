
import { resolve } from 'path'
import { loadNuxtConfig } from '../src/load'

describe('config: load', () => {
  test('load local nuxtrc', async () => {
    const config = await loadNuxtConfig({ rootDir: resolve(__dirname, 'fixtures/nuxtrc') })
    expect(config.rc.works).toBe(true)
  })

  test('load local nuxtrc', async () => {
    const config = await loadNuxtConfig({ rootDir: resolve(__dirname, 'fixtures/nuxtrc') })
    expect(config._env.ORIGINAL).toBe('original')
    expect(config._env.SHOULD_BE_OVERRIDEN_BY_LOCAL).toBe('local')
    expect(config._env.SHOULD_BE_OVERRIDEN_BY_MODE).toBe('mode')
    expect(config._env.SHOULD_BE_OVERRIDEN_BY_MODE_LOCAL).toBe('mode_local')
  })
})
