
import { resolve } from 'path'
import { loadNuxtConfig } from '../src/load'

describe('config: load', () => {
  test('load local nuxtrc', async () => {
    const config = await loadNuxtConfig({ rootDir: resolve(__dirname, 'fixtures/nuxtrc') })
    expect(config.rc.works).toBe(true)
  })
})
