import type { Plugin } from 'vite'
import { getQuery } from 'ufo'
import MagicString from 'magic-string'

const DEFINE_COMPONENT_VUE = '_defineComponent('
const DEFINE_COMPONENT_NUXT = '_defineNuxtComponent('

export function transformNuxtSetup () {
  return <Plugin> {
    name: 'nuxt:transform-setup',
    transform (code, id) {
      const query = getQuery(id)
      if (!(id.endsWith('.vue') || (query.nuxt && query.setup && query.type === 'script'))) {
        return
      }

      const index = code.indexOf(DEFINE_COMPONENT_VUE)
      if (index < 0) {
        return
      }

      const s = new MagicString(code)
      s.overwrite(index, index + DEFINE_COMPONENT_VUE.length, DEFINE_COMPONENT_NUXT)
      s.prepend('import { defineNuxtComponent as _defineNuxtComponent } from "#app"\n')
      return {
        code: s.toString(),
        map: s.generateMap()
      }
    }
  }
}
