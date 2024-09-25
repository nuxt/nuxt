import { isIgnored } from '@nuxt/kit'
import type { Nuxt } from 'nuxt/schema'
import type { Import } from 'unimport'
import { createUnimport } from 'unimport'
import { createUnplugin } from 'unplugin'
import { parseURL } from 'ufo'
import { parseQuery } from 'vue-router'
import { normalize, resolve } from 'pathe'
import { genImport } from 'knitwork'
import { distDir } from '../../dirs'
import type { getComponentsT } from '../module'

const COMPONENT_QUERY_RE = /[?&]nuxt_component=/

export function createTransformPlugin (nuxt: Nuxt, getComponents: getComponentsT, mode: 'client' | 'server' | 'all') {
  const serverComponentRuntime = resolve(distDir, 'components/runtime/server-component')
  const componentUnimport = createUnimport({
    imports: [
      {
        name: 'componentNames',
        from: '#build/component-names',
      },
    ],
    virtualImports: ['#components'],
    injectAtEnd: true,
  })

  function getComponentsImports (): Import[] {
    const components = getComponents(mode)
    return components.flatMap((c): Import[] => {
      const withMode = (mode: string | undefined) => mode
        ? `${c.filePath}${c.filePath.includes('?') ? '&' : '?'}nuxt_component=${mode}&nuxt_component_name=${c.pascalName}&nuxt_component_export=${c.export || 'default'}`
        : c.filePath

      const mode = !c._raw && c.mode && ['client', 'server'].includes(c.mode) ? c.mode : undefined

      return [
        {
          as: c.pascalName,
          from: withMode(mode),
          name: c.export || 'default',
        },
        {
          as: 'Lazy' + c.pascalName,
          from: withMode([mode, 'async'].filter(Boolean).join(',')),
          name: c.export || 'default',
        },
      ]
    })
  }

  return createUnplugin(() => ({
    name: 'nuxt:components:imports',
    enforce: 'post',
    transformInclude (id) {
      id = normalize(id)
      return id.startsWith('virtual:') || id.startsWith('\0virtual:') || id.startsWith(nuxt.options.buildDir) || !isIgnored(id)
    },
    async transform (code, id) {
      // Virtual component wrapper
      if (COMPONENT_QUERY_RE.test(id)) {
        const { search } = parseURL(id)
        const query = parseQuery(search)
        const mode = query.nuxt_component
        const bare = id.replace(/\?.*/, '')
        const componentExport = query.nuxt_component_export as string || 'default'
        const exportWording = componentExport === 'default' ? 'export default' : `export const ${componentExport} =`
        if (mode === 'async') {
          return {
            code: [
              'import { defineAsyncComponent } from "vue"',
              `${exportWording} defineAsyncComponent(() => import(${JSON.stringify(bare)}).then(r => r[${JSON.stringify(componentExport)}] || r.default || r))`,
            ].join('\n'),
            map: null,
          }
        } else if (mode === 'client') {
          return {
            code: [
              genImport(bare, [{ name: componentExport, as: '__component' }]),
              'import { createClientOnly } from "#app/components/client-only"',
              `${exportWording} createClientOnly(__component)`,
            ].join('\n'),
            map: null,
          }
        } else if (mode === 'client,async') {
          return {
            code: [
              'import { defineAsyncComponent } from "vue"',
              'import { createClientOnly } from "#app/components/client-only"',
              `${exportWording} defineAsyncComponent(() => import(${JSON.stringify(bare)}).then(r => createClientOnly(r[${JSON.stringify(componentExport)}] || r.default || r)))`,
            ].join('\n'),
            map: null,
          }
        } else if (mode === 'server' || mode === 'server,async') {
          const name = query.nuxt_component_name
          return {
            code: [
              `import { createServerComponent } from ${JSON.stringify(serverComponentRuntime)}`,
              `${exportWording} createServerComponent(${JSON.stringify(name)})`,
            ].join('\n'),
            map: null,
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
          : undefined,
      }
    },
  }))
}
