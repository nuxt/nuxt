import chalk from 'chalk'
import consola from 'consola'
import env from 'std-env'
import { prompt } from 'enquirer'
import { existsSync, writeJSON } from 'fs-extra'
import { register } from 'ts-node'

async function generateTsConfig(tsConfigPath) {
  const configToExtend = '@nuxt/typescript'
  await writeJSON(tsConfigPath, {
    extends: configToExtend,
    compilerOptions: {
      baseUrl: '.',
      types: [
        '@types/node',
        '@nuxt/vue-app'
      ]
    }
  }, { spaces: 2 })
  consola.info(`Extending ${chalk.bold.blue(`node_modules/${configToExtend}/tsconfig.json`)}`)
  consola.success(`Generated successfully at ${chalk.bold.green(tsConfigPath)}`)
}

let _setup = false

export async function setup(tsConfigPath) {
  if (_setup) {
    return
  }
  _setup = true

  if (!existsSync(tsConfigPath)) {
    const { confirmGeneration } = await prompt({
      type: 'confirm',
      name: 'confirmGeneration',
      message: `${chalk.bold.blue(tsConfigPath)} is missing, generate it ?`,
      initial: true,
      skip: env.minimal
    })

    if (confirmGeneration) {
      await generateTsConfig(tsConfigPath)
    }
  }
  // https://github.com/TypeStrong/ts-node
  register({
    project: tsConfigPath,
    compilerOptions: {
      module: 'commonjs'
    },
    transpileOnly: process.argv[2] === 'start'
  })
}
