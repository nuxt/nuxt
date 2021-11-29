import { addVitePlugin, addWebpackPlugin, useNuxt } from '@nuxt/kit'
import scriptSetupPlugin from 'unplugin-vue2-script-setup'
import type { ScriptSetupOptions } from '../types'

export const setupScriptSetup = (options: ScriptSetupOptions) => {
  const nuxt = useNuxt()
  const config = options === true ? {} : options

  addVitePlugin(scriptSetupPlugin.vite(config))
  addWebpackPlugin(scriptSetupPlugin.webpack(config))

  nuxt.hook('prepare:types', ({ references }) => {
    references.push({
      types: 'unplugin-vue2-script-setup/types'
    })
  })
}
