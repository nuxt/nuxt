import { resolve } from 'path'
import consola from 'consola'
import { build, compileHTMLTemplate, ensureDist } from './build'
import { getBaseConfig } from './config'

async function _runCLI () {
  const rootDir = resolve(process.cwd(), process.argv[2] || '.')

  // Config
  const baseConfig = getBaseConfig(rootDir)

  // Ensure dist exists
  await ensureDist(baseConfig)

  // Compile html template
  await compileHTMLTemplate(baseConfig)

  // Bundle for each target
  for (const target of baseConfig.targets) {
    if (baseConfig.target && target.target !== baseConfig.target) {
      continue
    }
    await build(baseConfig, target)
  }
}

export function runCLI () {
  _runCLI().catch((err) => {
    consola.error(err)
    process.exit(1)
  })
}
