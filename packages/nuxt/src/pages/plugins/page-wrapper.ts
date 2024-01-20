import { createUnplugin } from "unplugin";
import { genExport, genImport } from 'knitwork';

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
      return id.includes('?page-component=true')
    },

    transform(source, id) {
      hasClientOnlyPage = clientOnlyRE.test(source)

      const idWithoutQuery = id.split('?')[0];

      return `${genImport(idWithoutQuery, 'Page')}\nexport default Page`
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
