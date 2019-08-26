
import { resolve } from 'path'
import zlib from 'zlib'
import fs from 'fs-extra'
import pify from 'pify'

const gzip = pify(zlib.gzip)
const brotli = pify(zlib.brotliCompress)
const compressSize = (input, compressor) => compressor(input).then(data => data.length)

const distDir = resolve(__dirname, '../fixtures/async-config/.nuxt/dist')

const getResourcesSize = async (mode) => {
  const { all } = await import(resolve(distDir, 'server', `${mode}.manifest.json`))
  const resources = all.filter(filename => filename.endsWith('.js'))
  const sizes = { uncompressed: 0, gzip: 0, brotli: 0 }
  for (const resource of resources) {
    const file = resolve(distDir, 'client', resource)
    const stat = await fs.stat(file)
    sizes.uncompressed += stat.size / 1024
    const fileContent = await fs.readFile(file)
    sizes.gzip += await compressSize(fileContent, gzip) / 1024
    sizes.brotli += await compressSize(fileContent, brotli) / 1024
  }
  return sizes
}

describe('nuxt basic resources size limit', () => {
  expect.extend({
    toBeWithinSize (received, size, rate) {
      const maxSize = size * (1 + rate)
      const minSize = size * (1 - rate)
      const pass = received >= minSize && received <= maxSize
      return {
        pass,
        message: () =>
          `expected ${received} to be within range ${minSize} - ${maxSize}`
      }
    }
  })

  it('should stay within the size limit range in legacy mode', async () => {
    const legacyResourcesSize = await getResourcesSize('client')

    const LEGACY_JS_RESOURCES_KB_SIZE = 194
    expect(legacyResourcesSize.uncompressed).toBeWithinSize(LEGACY_JS_RESOURCES_KB_SIZE, 0.05)

    const LEGACY_JS_RESOURCES_GZIP_KB_SIZE = 66
    expect(legacyResourcesSize.gzip).toBeWithinSize(LEGACY_JS_RESOURCES_GZIP_KB_SIZE, 0.05)

    const LEGACY_JS_RESOURCES_BROTLI_KB_SIZE = 58
    expect(legacyResourcesSize.brotli).toBeWithinSize(LEGACY_JS_RESOURCES_BROTLI_KB_SIZE, 0.05)
  })

  it('should stay within the size limit range in modern mode', async () => {
    const modernResourcesSize = await getResourcesSize('modern')

    const MODERN_JS_RESOURCES_KB_SIZE = 172
    expect(modernResourcesSize.uncompressed).toBeWithinSize(MODERN_JS_RESOURCES_KB_SIZE, 0.05)

    const MODERN_JS_RESOURCES_GZIP_KB_SIZE = 59
    expect(modernResourcesSize.gzip).toBeWithinSize(MODERN_JS_RESOURCES_GZIP_KB_SIZE, 0.05)

    const MODERN_JS_RESOURCES_BROTLI_KB_SIZE = 52
    expect(modernResourcesSize.brotli).toBeWithinSize(MODERN_JS_RESOURCES_BROTLI_KB_SIZE, 0.05)
  })
})
