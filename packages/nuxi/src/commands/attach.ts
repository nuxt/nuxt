import { readFile, writeFile } from 'node:fs/promises'
import { consola } from 'consola'
import { execa } from 'execa'
import { resolve } from 'pathe'
import { getPackageManager } from '../utils/packageManagers'
import { defineNuxtCommand } from './index'

const modules: Record<string, string> = {
  tailwind: '@nuxtjs/tailwindcss',
  pinia: '@pinia/nuxt',
  eslint: '@nuxtjs/eslint-module',
  image: '@nuxt/image',
  i18n: '@nuxtjs/i18n',
  content: '@nuxt/content',
  icon: 'nuxt-icon',
  apollo: '@nuxtjs/apollo'
  // ...
  // TODO: add the rest of modules
  // and move to an external source...
}

export default defineNuxtCommand({
  meta: {
    name: 'attach',
    usage: 'npx nuxi attach <module>',
    description: 'Add a Nuxt module to the project'
  },
  async invoke (args) {
    const [module, _rootDir = '.'] = args._
    const rootDir = resolve(_rootDir)

    // Validate module name
    if (!module) {
      consola.error('Please specify a module to attach!')
      process.exit(1)
    }

    // Check if module exists
    if (!(module in modules)) {
      consola.error('The specified module doesn\'t exist.')
      return
    }

    const moduleName = modules[module]
    const packageManager = getPackageManager(rootDir) || 'npm'

    // Update nuxt.config.ts
    const configFilePath = 'nuxt.config.ts'
    const configContents = await readFile(configFilePath, 'utf-8')

    if (configContents.includes(moduleName)) {
      consola.info(`🔗 ${moduleName} already installed.`)
      return
    }
    // Install module
    consola.info(`Installing ${moduleName}...`)

    // Use the right package manager to install the modules
    await execa(packageManager, ['add', '-D', moduleName])
    const updatedContents = updateConfigModules(configContents, moduleName)

    // Write updated nuxt.config.ts file
    await writeFile(configFilePath, updatedContents)

    consola.ready(`✨ ${module} attached successfully.`)
  }
})

function updateConfigModules (configContents: string, moduleName: string): string {
  const modulesRegex = /modules\s*:\s*\[([\s\S]*?)]/
  const match = modulesRegex.exec(configContents)

  if (match) {
    // Update existing modules array
    const [, modulesArray] = match
    const updatedModulesArray = `${modulesArray.trim().replace(/,\s*$/, '')}, '${moduleName}'`
    const updatedContents = configContents.replace(modulesRegex, `modules: [${updatedModulesArray}]`)
    return updatedContents
  } else {
    // Add modules key and value
    const updatedContents = configContents.replace(
      /export\s+default\s+(.*?{)/s,
      `export default $1\n  modules: ['${moduleName}'],`
    )
    return updatedContents
  }
}
