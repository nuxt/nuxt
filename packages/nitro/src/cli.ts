import { resolve } from 'path'
import { build, compileHTMLTemplate, ensureDist, generatePublic } from './build'
import { getBaseConfig } from './config'

export async function runCLI () {
  const rootDir = resolve(process.cwd(), process.argv[2] || '.')

  // Config
  const baseConfig = getBaseConfig(rootDir)

  // Ensure dist exists
  await ensureDist(baseConfig)

  // Compile html template
  await compileHTMLTemplate(baseConfig)

  // Generate public dir
  await generatePublic(baseConfig)

  // Bundle for each target
  for (const target of baseConfig.targets) {
    if (baseConfig.target && target.target !== baseConfig.target) {
      continue
    }
    await build(baseConfig, target)
  }
}
