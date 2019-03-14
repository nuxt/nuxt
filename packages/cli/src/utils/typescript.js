import path from 'path'
import { existsSync } from 'fs'
import chalk from 'chalk'
import consola from 'consola'
import { warningBox } from './formatting'

const dependencyNotFoundMessage =
`Please install @nuxt/typescript and rerun the command

${chalk.bold('Using yarn')}
yarn add -D @nuxt/typescript

${chalk.bold('Using npm')}
npm install -D @nuxt/typescript`

export async function detectAndSetupTypeScriptSupport(rootDir, options = {}) {
  const tsConfigPath = path.resolve(rootDir, 'tsconfig.json')

  if (!existsSync(tsConfigPath)) {
    return false
  }

  consola.info(`${chalk.bold.blue('tsconfig.json')} found, enabling TypeScript runtime support`)

  try {
    const { setup } = require('@nuxt/typescript')
    await setup(tsConfigPath, options)
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      process.stdout.write(warningBox(dependencyNotFoundMessage, chalk.yellow('An external official dependency is needed to enable TS support')))
      process.exit(1)
    } else {
      throw (e)
    }
  }

  return true
}
