import { useNuxt } from '@nuxt/kit'
import VirtualModulesPlugin from 'webpack-virtual-modules'

export function registerVirtualModules () {
  const nuxt = useNuxt()

  // Initialize virtual modules instance
  const virtualModules = new VirtualModulesPlugin(nuxt.vfs)
  const writeFiles = () => {
    for (const filePath in nuxt.vfs) {
      virtualModules.writeModule(filePath, nuxt.vfs[filePath])
    }
  }

  // Workaround to initialize virtual modules
  nuxt.hook('build:compile', ({ compiler }) => {
    if (compiler.name === 'server') { writeFiles() }
  })
  // Update virtual modules when templates are updated
  nuxt.hook('app:templatesGenerated', writeFiles)

  nuxt.hook('webpack:config', configs => configs.forEach((config) => {
    // Support virtual modules (input)
    config.plugins.push(virtualModules)
  }))
}
