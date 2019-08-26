
import { resolve } from 'path'
import fs from 'fs-extra'

const distDir = resolve(__dirname, '../fixtures/async-config/.nuxt/dist')

const getResourcesSize = async (mode) => {
  const manifestFile = resolve(distDir, 'server', `${mode}.manifest.json`)
  const { all } = await import(manifestFile)
  const resources = all.filter(filename => filename.endsWith('.js'))
  let size = 0
  for (const resource of resources) {
    const stat = await fs.stat(resolve(distDir, 'client', resource))
    size += stat.size / 1024
  }
  return size
}

describe('nuxt basic resources size limit', () => {
  it('should stay within the size limit range in legacy mode', async () => {
    const LEGACY_JS_RESOURCES_KB_SIZE = 195
    const legacyResourcesSize = await getResourcesSize('client')
    expect(legacyResourcesSize).toBeLessThanOrEqual(LEGACY_JS_RESOURCES_KB_SIZE * 1.05)
    expect(legacyResourcesSize).toBeGreaterThanOrEqual(LEGACY_JS_RESOURCES_KB_SIZE * 0.95)
  })

  it('should stay within the size limit range in modern mode', async () => {
    const MODERN_JS_RESOURCES_KB_SIZE = 172
    const modernResourcesSize = await getResourcesSize('modern')
    expect(modernResourcesSize).toBeLessThanOrEqual(MODERN_JS_RESOURCES_KB_SIZE * 1.05)
    expect(modernResourcesSize).toBeGreaterThanOrEqual(MODERN_JS_RESOURCES_KB_SIZE * 0.95)
  })
})
