import { resolve } from 'path'
import chalk from 'chalk'
import consola from 'consola'
import env from 'std-env'
import { existsSync, writeJSON } from 'fs-extra'
import { register } from 'ts-node'
import { prompt } from 'enquirer'

export async function generateTsConfigIfMissing(rootDir) {
  const tsConfigPath = resolve(rootDir, 'tsconfig.json')

  if (!existsSync(tsConfigPath)) {
    const { confirmGeneration } = await prompt({
      type: 'confirm',
      name: 'confirmGeneration',
      message: `Missing ${chalk.bold.blue('tsconfig.json')} in ${rootDir === process.cwd() ? 'current directory' : chalk.bold.green(resolve(rootDir))}, generate it ?`,
      initial: true,
      skip: env.minimal
    })

    if (confirmGeneration) {
      await writeJSON(tsConfigPath, {
        extends: 'nuxt-ts',
        compilerOptions: {
          baseUrl: '.'
        }
      }, { spaces: 2 })
      consola.info(`Extending ${chalk.bold.blue('https://github.com/nuxt/nuxt.js/blob/master/distributions/nuxt-ts/tsconfig.json')}`)
      consola.success(`Generated successfully at ${chalk.bold.green(resolve(rootDir, 'tsconfig.json'))}`)
    }
  }
}

export function registerTsNode() {
  // https://github.com/TypeStrong/ts-node
  register()
}
