import { resolve } from 'path'
import { prompt } from 'enquirer'
import { existsSync, writeJSON } from 'fs-extra'
import chalk from 'chalk'
import consola from 'consola'
import env from 'std-env'

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
      const configToExtend = '@nuxt/typescript'
      await writeJSON(tsConfigPath, {
        extends: configToExtend,
        compilerOptions: {
          baseUrl: '.'
        }
      }, { spaces: 2 })
      consola.info(`Extending ${chalk.bold.blue(`node_modules/${configToExtend}/tsconfig.json`)}`)
      consola.success(`Generated successfully at ${chalk.bold.green(resolve(rootDir, 'tsconfig.json'))}`)
    }
  }
}
