import { createRequire } from 'module'
import { addVitePlugin, addWebpackPlugin, useNuxt } from '@nuxt/kit'

const _require = createRequire(import.meta.url)
const scriptSetupPlugin = _require('unplugin-vue2-script-setup').default

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
