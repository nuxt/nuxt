import { useNuxt } from '@nuxt/kit'
import fs from "fs-extra";
import path from "path";
// import VirtualModulesPlugin from 'webpack-virtual-modules'

export function registerVirtualModules () {
  const nuxt = useNuxt()

  // Initialize virtual modules instance
  // const virtualModules = new VirtualModulesPlugin(nuxt.vfs)
  const writeFiles = () => {
    console.log('writing files')
    for (const filePath in nuxt.vfs) {
      if (path.isAbsolute(filePath)) {
        fs.writeFileSync(filePath, nuxt.vfs[filePath])
      } else {
        // const p = path.join(nuxt.options.buildDir, filePath)
        // fs.createFileSync(p)
        // fs.writeFileSync(p, nuxt.vfs[filePath])
      }
      // virtualModules.writeModule(filePath, nuxt.vfs[filePath])
    }
  }

  // Workaround to initialize virtual modules
  nuxt.hook('rspack:compile', ({ compiler }) => {
    writeFiles()
    if (compiler.name === 'server') { writeFiles() }
  })
  // Update virtual modules when templates are updated
  nuxt.hook('app:templatesGenerated', writeFiles)

  nuxt.hook('rspack:config', configs => configs.forEach((config) => {
    // Support virtual modules (input)
    // config.plugins!.push(virtualModules)
    if (config.resolve && config.resolve.alias) {
      // @ts-ignore
      // config.resolve.alias['#build'] = path.join(nuxt.options.buildDir, '#build')
    }
  }))
}
