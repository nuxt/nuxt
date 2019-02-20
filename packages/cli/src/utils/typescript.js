import path from 'path'
import { existsSync } from 'fs'
import chalk from 'chalk'
import consola from 'consola'
import { warningBox } from './formatting'

export async function getTypescriptConfig(rootDir, extraOptions = {}) {
  const tsConfigPath = path.resolve(rootDir, 'tsconfig.json')

  if (!existsSync(tsConfigPath)) {
    return undefined
  }

  consola.info('TypeScript environment detected')

  try {
    const { setup } = require('@nuxt/typescript')
    await setup(tsConfigPath, { transpileOnly: !!extraOptions._start })
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      const messageLines = [
        'Please install @nuxt/typescript and rerun the command',
        '',
        chalk.bold('Using yarn'),
        'yarn add -D @nuxt/typescript',
        '',
        chalk.bold('Using npm'),
        'npm install -D @nuxt/typescript'
      ]
      process.stdout.write(warningBox(messageLines.join('\n'), chalk.yellow('An external official dependency is needed to enable TS support')))
      process.exit(0)
    } else {
      throw (e)
    }
  }

  return {
    typeCheck: {
      vue: true,
      tsconfig: path.resolve(rootDir, 'tsconfig.json'),
      // https://github.com/Realytics/fork-ts-checker-webpack-plugin#options - tslint: boolean | string - So we set it false if file not found
      tslint: (tslintPath => existsSync(tslintPath) && tslintPath)(path.resolve(rootDir, 'tslint.json')),
      formatter: 'codeframe',
      logger: consola
    }
  }
}
