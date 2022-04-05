import { useNuxt } from '@nuxt/kit'
import { addModuleTranspiles } from '../../nuxt3/src/core/modules'

export const setupTranspile = () => {
  const nuxt = useNuxt()

  nuxt.hook('modules:done', () => {
    addModuleTranspiles({
      additionalModules: ['@nuxt/bridge-edge']
    })
  })
}
