import { normalize } from 'pathe'
import type { Component, Nuxt } from '@nuxt/schema'
import type { Plugin } from 'vite'

const ONIGIRI_ID_RE = /[?&]vue&type=onigiri\b/
const WRAPPER_QUERY_RE = /[?&]nuxt_component=/

/**
 * Point the client's vue-onigiri render modules at the `createServerComponent` wrapper for
 * server-only components, as the loader does for `_resolveComponent`, so their implementation
 * stays out of the client bundle. The render function itself never runs in the browser.
 */
export function OnigiriServerComponentsPlugin (nuxt: Nuxt): Plugin | undefined {
  if (nuxt.options.experimental.componentIslands !== 'vue-onigiri') {
    return
  }

  // server-only component file -> the id `nuxt:components:imports-wrapper` answers
  let wrappers = new Map<string, string>()
  const ingest = (components: Component[]) => {
    wrappers = new Map()
    for (const c of components) {
      if (c._raw || c.mode !== 'server' || components.some(o => o.pascalName === c.pascalName && o.mode === 'client')) {
        continue
      }
      const filePath = normalize(c.filePath)
      wrappers.set(filePath, `${filePath}${filePath.includes('?') ? '&' : '?'}nuxt_component=server&nuxt_component_name=${c.pascalName}&nuxt_component_export=${c.export || 'default'}`)
    }
  }
  for (const app of Object.values(nuxt.apps)) {
    if (app.components) {
      ingest(app.components)
    }
  }
  nuxt.hook('components:extend', ingest)

  return {
    name: 'nuxt:onigiri-server-components',
    enforce: 'pre',
    applyToEnvironment: env => env.name === 'client',
    resolveId: {
      order: 'pre',
      async handler (id, importer) {
        if (!importer || !ONIGIRI_ID_RE.test(importer) || WRAPPER_QUERY_RE.test(id)) {
          return
        }
        const resolved = await this.resolve(id, importer, { skipSelf: true })
        return resolved ? wrappers.get(normalize(resolved.id)) : undefined
      },
    },
  }
}
