import { isIgnored } from '@nuxt/kit'
import type { Nuxt } from 'nuxt/schema'
import type { Import } from 'unimport'
import { createUnimport } from 'unimport'
import { createUnplugin } from 'unplugin'
import { parseURL } from 'ufo'
import { parseQuery } from 'vue-router'
import type { getComponentsT } from './module'

const COMPONENT_QUERY_RE = /[?&]nuxt_component=/

export function createTransformPlugin (nuxt: Nuxt, getComponents: getComponentsT, mode: 'client' | 'server' | 'all') {
  const componentUnimport = createUnimport({
    imports: [
      {
        name: 'componentNames',
        from: '#build/component-names'
      }
    ],
    virtualImports: ['#components']
  })

  function getComponentsImports (): Import[] {
    const components = getComponents(mode)
    return components.flatMap((c): Import[] => {
      const withMode = (mode: string | undefined) => mode
        ? `${c.filePath}${c.filePath.includes('?') ? '&' : '?'}nuxt_component=${mode}`
        : c.filePath

      return [
        {
          as: c.pascalName,
          from: withMode(c.mode === 'client' ? 'client' : undefined),
          name: 'default'
        },
        {
          as: 'Lazy' + c.pascalName,
          from: withMode([c.mode === 'client' ? 'client' : '', 'async'].filter(Boolean).join(',')),
          name: 'default'
        }
      ]
    })
  }

  return createUnplugin(() => ({
    name: 'nuxt:components:imports',
    transformInclude (id) {
      return !isIgnored(id)
    },
    async transform (code, id) {
      // Virtual component wrapper
      if (COMPONENT_QUERY_RE.test(id)) {
        const { search } = parseURL(id)
        const query = parseQuery(search)
        const mode = query.nuxt_component
        const bare = id.replace(/\?.*/, '')
        if (mode === 'async') {
          return {
            code: [
              'import { defineAsyncComponent } from "vue"',
              `export default defineAsyncComponent(() => import(${JSON.stringify(bare)}).then(r => r.default))`
            ].join('\n'),
            map: null
          }
        } else if (mode === 'client') {
          return {
            code: [
              `import __component from ${JSON.stringify(bare)}`,
              'import { createClientOnly } from "#app/components/client-only"',
              'export default createClientOnly(__component)'
            ].join('\n'),
            map: null
          }
        } else if (mode === 'client,async') {
          return {
            code: [
              'import { defineAsyncComponent } from "vue"',
              'import { createClientOnly } from "#app/components/client-only"',
              `export default defineAsyncComponent(() => import(${JSON.stringify(bare)}).then(r => createClientOnly(r.default)))`
            ].join('\n'),
            map: null
          }
        } else {
          throw new Error(`Unknown component mode: ${mode}, this might be an internal bug of Nuxt.`)
        }
      }

      if (!code.includes('#components')) { return }

      componentUnimport.modifyDynamicImports((imports) => {
        imports.length = 0
        imports.push(...getComponentsImports())
        return imports
      })

      const result = await componentUnimport.injectImports(code, id, { autoImport: false, transformVirtualImports: true })
      if (!result) { return }

      return {
        code: result.code,
        map: nuxt.options.sourcemap.server || nuxt.options.sourcemap.client
          ? result.s.generateMap({ hires: true })
          : undefined
      }
    }
  }))
}
