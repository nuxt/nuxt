import { addVitePlugin, addWebpackPlugin, useNuxt } from '@nuxt/kit'
import scriptSetupPlugin from 'unplugin-vue2-script-setup'

export const setupScriptSetup = () => {
  const nuxt = useNuxt()

  addVitePlugin(scriptSetupPlugin.vite())
  addWebpackPlugin(scriptSetupPlugin.webpack())

  nuxt.hook('prepare:types', ({ references }) => {
    references.push({
      types: 'unplugin-vue2-script-setup/types'
    })
  })
}
