import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { toVirtualId } from '../utils/index.ts'

/**
 * Plugin that handles template invalidation and HMR when Nuxt templates are regenerated.
 */
export function TemplateHMRPlugin (nuxt: Nuxt): Plugin {
  return {
    name: 'nuxt:template-hmr',
    configureServer (viteServer) {
      // Invalidate virtual modules when templates are re-generated
      nuxt.hook('app:templatesGenerated', async (_app, changedTemplates) => {
        await Promise.all(changedTemplates.map(async (template) => {
          for (const mod of viteServer.moduleGraph.getModulesByFile(toVirtualId(template.dst, nuxt)) || []) {
            viteServer.moduleGraph.invalidateModule(mod)
            await viteServer.reloadModule(mod)
          }
        }))
      })
    },
  }
}
