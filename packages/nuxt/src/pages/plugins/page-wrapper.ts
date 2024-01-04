import { createUnplugin } from "unplugin";
import { genImport } from 'knitwork';

const cache = new Map<string, string>()

const clientOnlyRE = /definePageMeta\({(?:.|\n)+clientOnly:\s?true/
const pageComponentVar = 'PageComponent';
const createClientOnlyVar = 'createClientOnly'
const createClientOnlyImport = genImport('#app/components/client-only', [createClientOnlyVar])

export const PageWrapper = createUnplugin((_options) => {
  return {
    name: 'nuxt:page-wrapper',
    transformInclude(id) {
      return id.includes('?page-component=true')
    },

    transform(code, id) {
      if (cache.has(id)) {
        return cache.get(id);
      }

      const reexport = [
        genImport(stripQuery(id), pageComponentVar)
      ]

      if (clientOnlyRE.test(code)) {
        reexport.push(createClientOnlyImport);
        reexport.push(`export default ${createClientOnlyVar}(${pageComponentVar})`)
      } else {
        reexport.push(`export default ${pageComponentVar}`)
      }

      const reexportCode = reexport.join('\n');

      cache.set(id, reexportCode)

      return reexportCode
    },
  }
})

function stripQuery(id: string) {
  return id.split('?')[0]
}
