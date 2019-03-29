import path from 'path'
import consola from 'consola'

export async function detectAndSetupTypeScriptSupport(rootDir, options = {}) {
  try {
    const { setup } = require('@nuxt/typescript')

    consola.info('Initializing typeScript support')
    await setup(path.resolve(rootDir, 'tsconfig.json'), options)
    consola.success('TypeScript support enabled')
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      return false
    } else {
      throw (e)
    }
  }

  return true
}
