import path from 'path'
import fs from 'fs-extra'
import consola from 'consola'
import * as imports from '../imports'

async function registerTSNode(tsConfigPath, options) {
  const { register } = await imports.tsNode()

  // https://github.com/TypeStrong/ts-node
  register({
    project: tsConfigPath,
    compilerOptions: {
      module: 'commonjs'
    },
    ...options
  })
}

async function getNuxtTypeScript() {
  try {
    return await imports.nuxtTypescript()
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') {
      throw (error)
    }
  }
}

export async function detectTypeScript(rootDir, options = {}) {
  // Check if tsconfig.json exists in project rootDir
  const tsConfigPath = path.resolve(rootDir, 'tsconfig.json')

  // Skip if tsconfig.json not exists
  if (!await fs.exists(tsConfigPath)) {
    return false
  }

  // Register runtime support
  await registerTSNode(tsConfigPath, options)

  // Try to load @nuxt/typescript
  const nuxtTypeScript = await getNuxtTypeScript()

  // If exists do additional setup
  if (nuxtTypeScript) {
    await nuxtTypeScript.setupDefaults(tsConfigPath)
  }

  consola.success('TypeScript support enabled')

  return true
}
