import { resolve } from 'path'
import { getResourcesSize } from '../utils'

const distDir = resolve(__dirname, '../fixtures/unicode-base/.nuxt/dist')

describe('nuxt minimal app resources size limit', () => {
  expect.extend({
    toBeWithinSize (received, size) {
      const maxSize = size * 1.01
      const minSize = size * 0.99
      const pass = received >= minSize && received <= maxSize
      return {
        pass,
        message: () =>
          `expected ${received} to be within range ${minSize} - ${maxSize}`
      }
    }
  })

  it('should stay within the size limit range in legacy mode', async () => {
    const legacyResourcesSize = await getResourcesSize(distDir, 'client')

    const LEGACY_JS_RESOURCES_KB_SIZE = 157
    expect(legacyResourcesSize.uncompressed).toBeWithinSize(LEGACY_JS_RESOURCES_KB_SIZE)

    const LEGACY_JS_RESOURCES_GZIP_KB_SIZE = 55
    expect(legacyResourcesSize.gzip).toBeWithinSize(LEGACY_JS_RESOURCES_GZIP_KB_SIZE)

    const LEGACY_JS_RESOURCES_BROTLI_KB_SIZE = 49
    expect(legacyResourcesSize.brotli).toBeWithinSize(LEGACY_JS_RESOURCES_BROTLI_KB_SIZE)
  })

  it('should stay within the size limit range in modern mode', async () => {
    const modernResourcesSize = await getResourcesSize(distDir, 'modern')

    const MODERN_JS_RESOURCES_KB_SIZE = 138
    expect(modernResourcesSize.uncompressed).toBeWithinSize(MODERN_JS_RESOURCES_KB_SIZE)

    const MODERN_JS_RESOURCES_GZIP_KB_SIZE = 49
    expect(modernResourcesSize.gzip).toBeWithinSize(MODERN_JS_RESOURCES_GZIP_KB_SIZE)

    const MODERN_JS_RESOURCES_BROTLI_KB_SIZE = 44
    expect(modernResourcesSize.brotli).toBeWithinSize(MODERN_JS_RESOURCES_BROTLI_KB_SIZE)
  })
})
