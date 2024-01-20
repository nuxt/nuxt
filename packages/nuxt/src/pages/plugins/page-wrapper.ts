import { createUnplugin } from "unplugin";
import { genExport } from 'knitwork';

const clientOnlyRE = /\bdefinePageMeta\({(?:.|\n)+clientOnly:\s?true/

const clientOnlyExportName = 'ClientOnly'
const clientOnlyExport = genExport('#app/components/client-only', [{ name: 'default', as: clientOnlyExportName }]);
const emptyClientOnlyExport = `export const ${clientOnlyExportName} = undefined`

const virtualPageWrapperModuleId = 'virtual:pages-wrapper'
const resolvedVirtualPageWrapperModuleId = '\0' + virtualPageWrapperModuleId

export const PageWrapper = createUnplugin(() => {
  let hasClientOnlyPage: boolean | undefined;

  return {
    name: 'nuxt:page-wrapper',

    transformInclude(id) {
      return id.includes('?macro=true')
    },

    transform(source) {
      if (!hasClientOnlyPage) {
        hasClientOnlyPage = clientOnlyRE.test(source)
      }

      return undefined
    },

    resolveId(id) {
      if (id === virtualPageWrapperModuleId) {
        return resolvedVirtualPageWrapperModuleId
      }
    },

    load(id) {
      if (id === resolvedVirtualPageWrapperModuleId) {
        return hasClientOnlyPage ? clientOnlyExport : emptyClientOnlyExport
      }
    }
  }
})
