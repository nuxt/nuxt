import path from 'path'
import { existsSync } from 'fs'
import chalk from 'chalk'
import consola from 'consola'

export async function detectAndSetupTypeScriptSupport(rootDir, options = {}) {
  const tsConfigPath = path.resolve(rootDir, 'tsconfig.json')

  // Check if tsconfig.json is existed
  if (!existsSync(tsConfigPath)) {
    return false
  }

  // Check if `@nuxt/typescript` is installed
  try {
    const { setup } = require('@nuxt/typescript')
    // Enabling TypeScript runtime
    await setup(tsConfigPath, options)
    consola.info(`${chalk.bold.blue('@nuxt/typescript')} and ${chalk.bold.blue('tsconfig.json')} found, enabling TypeScript runtime support`)
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw (e)
    }
    return false
  }

  return true
}
