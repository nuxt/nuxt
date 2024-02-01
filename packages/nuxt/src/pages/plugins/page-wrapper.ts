import { createUnplugin } from "unplugin";
import { genExport } from 'knitwork';

import type { NuxtPage } from "nuxt/schema";

const clientOnlyExportName = 'ClientOnly'
const clientOnlyExport = genExport('#app/components/client-only', [{ name: 'default', as: clientOnlyExportName }]);
const emptyClientOnlyExport = `export const ${clientOnlyExportName} = undefined`

const virtualPageWrapperModuleId = 'virtual:pages-wrapper'
const resolvedVirtualPageWrapperModuleId = '\0' + virtualPageWrapperModuleId

export interface PageWrapperPluginOptions {
  pages: NuxtPage[]
}

export const PageWrapperPlugin = createUnplugin((options: PageWrapperPluginOptions) => {
  const hasClientOnlyPage = options.pages.some(page => page.meta?.mode === 'client');

  return {
    name: 'nuxt:page-wrapper',

    resolveId(id) {
      if (id.endsWith('pages-wrapper.mjs')) {
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
