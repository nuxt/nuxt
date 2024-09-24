import { useNuxt } from '@nuxt/kit'
// @ts-expect-error work around jiti issue with module.exports =
import * as _VirtualModulesPlugin from 'webpack-virtual-modules'
// @ts-expect-error work around jiti issue with module.exports =
const VirtualModulesPlugin = (_VirtualModulesPlugin.default || _VirtualModulesPlugin) as typeof import('webpack-virtual-modules')

export function registerVirtualModules () {
  const nuxt = useNuxt()

  // Initialize virtual modules instance
  const virtualModules = new VirtualModulesPlugin(nuxt.vfs)
  const writeFiles = () => {
    for (const filePath in nuxt.vfs) {
      virtualModules.writeModule(filePath, nuxt.vfs[filePath] || '')
    }
  }

  // Workaround to initialize virtual modules
  nuxt.hook('webpack:compile', ({ compiler }) => {
    if (compiler.name === 'server') { writeFiles() }
  })
  nuxt.hook('rspack:compile', ({ compiler }) => {
    if (compiler.name === 'server') { writeFiles() }
  })
  // Update virtual modules when templates are updated
  nuxt.hook('app:templatesGenerated', writeFiles)

  nuxt.hook('webpack:config', configs => configs.forEach((config) => {
    // Support virtual modules (input)
    config.plugins!.push(virtualModules)
  }))
  nuxt.hook('rspack:config', configs => configs.forEach((config) => {
    // Support virtual modules (input)
    config.plugins!.push(virtualModules)
  }))
}
