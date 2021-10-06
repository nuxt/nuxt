import { resolve } from 'pathe'
import { addTemplate, useNuxt, installModule } from '@nuxt/kit'
import metaModule from '../../nuxt3/src/meta/module'
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
      getContents: () => `export const useMeta = () => console.warn('${msgPrefix} To use \`useMeta\`, please set \`bridge.meta\` to \`true\` in your \`nuxt.config\`. ${checkDocsMsg}')`
    })
    nuxt.options.alias['#meta'] = metaPath.dst
    return
  }

  if (nuxt.options.head && typeof nuxt.options.head === 'function') {
    throw new TypeError(`${msgPrefix} The head() function in \`nuxt.config\` has been deprecated and in nuxt3 will need to be moved to \`app.vue\`. ${checkDocsMsg}`)
  }

  const runtimeDir = resolve(distDir, 'runtime/meta')
  nuxt.options.alias['#meta'] = runtimeDir

  await installModule(nuxt, metaModule)
}
