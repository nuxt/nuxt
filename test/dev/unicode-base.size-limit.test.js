import { resolve } from 'path'
import { getResourcesSize } from '../utils'

const distDir = resolve(__dirname, '../fixtures/unicode-base/.nuxt/dist')

describe('nuxt minimal vue-app bundle size limit', () => {
  expect.extend({
    toBeWithinSize (received, size) {
      const maxSize = size * 1.02
      const minSize = size * 0.98
      const pass = received >= minSize && received <= maxSize
      return {
        pass,
        message: () =>
          `expected ${received} to be within range ${minSize} - ${maxSize}`
      }
    }
  })

  it('should stay within the size limit range', async () => {
    const filter = filename => filename === 'vue-app.nuxt.js'
    const legacyResourcesSize = await getResourcesSize(distDir, 'client', { filter })
    const LEGACY_JS_RESOURCES_KB_SIZE = 16.6
    expect(legacyResourcesSize.uncompressed).toBeWithinSize(LEGACY_JS_RESOURCES_KB_SIZE)
  })
})
