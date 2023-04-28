import { isIgnored } from '@nuxt/kit'
import type { Nuxt } from 'nuxt/schema'
import type { Import } from 'unimport'
import { createUnimport } from 'unimport'
import { createUnplugin } from 'unplugin'
import { parseURL } from 'ufo'
import { parseQuery } from 'vue-router'
import type { getComponentsT } from './module'

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
      return [
        {
          as: c.pascalName,
          from: c.filePath + (c.mode === 'client' ? '?component=client' : ''),
          name: 'default'
        },
        {
          as: 'Lazy' + c.pascalName,
          from: c.filePath + '?component=' + [c.mode === 'client' ? 'client' : '', 'async'].filter(Boolean).join(','),
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
      if (id.includes('?component')) {
        const { search } = parseURL(id)
        const query = parseQuery(search)
        const mode = query.component
        const bare = id.replace(/\?.*/, '')
        if (mode === 'async') {
          return [
            'import { defineAsyncComponent } from "vue"',
            `export default defineAsyncComponent(() => import(${JSON.stringify(bare)}).then(r => r.default))`
          ].join('\n')
        } else if (mode === 'client') {
          return [
            `import __component from ${JSON.stringify(bare)}`,
            'import { createClientOnly } from "#app/components/client-only"',
            'export default createClientOnly(__component)'
          ].join('\n')
        } else if (mode === 'client,async') {
          return [
            'import { defineAsyncComponent } from "vue"',
            'import { createClientOnly } from "#app/components/client-only"',
            `export default defineAsyncComponent(() => import(${JSON.stringify(bare)}).then(r => createClientOnly(r.default)))`
          ].join('\n')
        } else {
          throw new Error(`Unknown component mode: ${mode}, this might be an internal bug of Nuxt.`)
        }
      }

      if (!code.includes('#components')) {
        return null
      }

      componentUnimport.modifyDynamicImports((imports) => {
        imports.length = 0
        imports.push(...getComponentsImports())
        return imports
      })

      const result = await componentUnimport.injectImports(code, id, { autoImport: false, transformVirtualImports: true })
      if (!result) {
        return null
      }
      return {
        code: result.code,
        map: nuxt.options.sourcemap
          ? result.s.generateMap({ hires: true })
          : undefined
      }
    }
  }))
}
