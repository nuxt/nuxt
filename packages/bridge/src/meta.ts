import { resolve } from 'pathe'
import { addTemplate, useNuxt, installModule } from '@nuxt/kit'
import metaModule from '../../nuxt3/src/head/module'
import { distDir } from './dirs'

const checkDocsMsg = 'Please see https://v3.nuxtjs.org for more information.'
const msgPrefix = '[bridge] [meta]'

interface SetupMetaOptions {
  needsExplicitEnable?: boolean
}

export const setupMeta = async (opts: SetupMetaOptions) => {
  const nuxt = useNuxt()

  if (opts.needsExplicitEnable) {
    const metaPath = addTemplate({
      filename: 'meta.mjs',
      getContents: () => `export const useHead = () => console.warn('${msgPrefix} To use \`useHead\`, please set \`bridge.meta\` to \`true\` in your \`nuxt.config\`. ${checkDocsMsg}')`
    })
    nuxt.options.alias['#head'] = metaPath.dst
    return
  }

  if (nuxt.options.head && typeof nuxt.options.head === 'function') {
    throw new TypeError(`${msgPrefix} The head() function in \`nuxt.config\` has been deprecated and in Nuxt 3 will need to be moved to \`app.vue\`. ${checkDocsMsg}`)
  }

  const runtimeDir = resolve(distDir, 'runtime/head')
  nuxt.options.alias['#head'] = runtimeDir

  await installModule(metaModule)
}
