import { resolve } from 'path'
import { getResourcesSize } from '../utils'

const distDir = resolve(__dirname, '../fixtures/async-config/.nuxt/dist')

describe('nuxt basic resources size limit', () => {
  expect.extend({
    toBeWithinSize (received, size) {
      const maxSize = size * 1.05
      const minSize = size * 0.95
      const pass = received >= minSize && received <= maxSize
      return {
        pass,
        message: () =>
          `expected ${received} to be within range ${minSize} - ${maxSize}`
      }
    }
  })

  it('should stay within the size limit range in legacy mode', async () => {
    const legacyResourcesSize = await getResourcesSize(distDir, 'client', { gzip: true, brotli: true })

    const LEGACY_JS_RESOURCES_KB_SIZE = 240
    expect(legacyResourcesSize.uncompressed).toBeWithinSize(LEGACY_JS_RESOURCES_KB_SIZE)

    const LEGACY_JS_RESOURCES_GZIP_KB_SIZE = 83
    expect(legacyResourcesSize.gzip).toBeWithinSize(LEGACY_JS_RESOURCES_GZIP_KB_SIZE)

    const LEGACY_JS_RESOURCES_BROTLI_KB_SIZE = 72
    expect(legacyResourcesSize.brotli).toBeWithinSize(LEGACY_JS_RESOURCES_BROTLI_KB_SIZE)
  })

  it('should stay within the size limit range in modern mode', async () => {
    const modernResourcesSize = await getResourcesSize(distDir, 'modern', { gzip: true, brotli: true })

    const MODERN_JS_RESOURCES_KB_SIZE = 210
    expect(modernResourcesSize.uncompressed).toBeWithinSize(MODERN_JS_RESOURCES_KB_SIZE)

    const MODERN_JS_RESOURCES_GZIP_KB_SIZE = 73
    expect(modernResourcesSize.gzip).toBeWithinSize(MODERN_JS_RESOURCES_GZIP_KB_SIZE)

    const MODERN_JS_RESOURCES_BROTLI_KB_SIZE = 64
    expect(modernResourcesSize.brotli).toBeWithinSize(MODERN_JS_RESOURCES_BROTLI_KB_SIZE)
  })
})
