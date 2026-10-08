import { isIgnored } from '@nuxt/kit'
import { buildDiagnostics, hasOwnSubpathImport } from '@nuxt/kit/internal'
import type { Import } from 'unimport'
import { createUnimport } from 'unimport'
import { createUnplugin } from 'unplugin'
import { parseModuleId } from '../../core/utils/plugins.ts'
import { normalize } from 'pathe'
import { genImport } from 'knitwork'
import type { getComponentsT } from '../module.ts'
import type { Nuxt } from 'nuxt/schema'

const COMPONENT_QUERY_RE = /[?&]nuxt_component=/
const IDENTIFIER_RE = /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u

interface TransformPluginOptions {
  getComponents: getComponentsT
  mode: 'client' | 'server' | 'all'
  serverComponentRuntime: string
}

export function TransformPlugin (nuxt: Nuxt, options: TransformPluginOptions) {
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
    const components = options.getComponents(options.mode)
    const clientOrServerModes = new Set(['client', 'server'])
    return components.flatMap((c): Import[] => {
      const withMode = (mode: string | undefined) => mode
        ? `${c.filePath}${c.filePath.includes('?') ? '&' : '?'}nuxt_component=${mode}&nuxt_component_name=${c.pascalName}&nuxt_component_export=${c.export || 'default'}`
        : c.filePath

      const mode = !c._raw && c.mode && clientOrServerModes.has(c.mode) ? c.mode : undefined

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

  return createUnplugin(() => [
    {
      name: 'nuxt:components:imports-wrapper',
      enforce: 'post',
      transformInclude (id) {
        id = normalize(id)
        return id.startsWith('virtual:') || id.startsWith('\0virtual:') || id.startsWith(nuxt.options.buildDir) || !isIgnored(id, undefined, nuxt)
      },
      transform: {
        filter: {
          id: COMPONENT_QUERY_RE,
        },
        handler (_code, id) {
          // Virtual component wrapper
          const { search } = parseModuleId(id)
          const params = new URLSearchParams(search)
          const mode = params.get('nuxt_component')
          const bare = id.replace(/\?.*/, '')
          const componentExport = params.get('nuxt_component_export') || 'default'
          if (!IDENTIFIER_RE.test(componentExport)) {
            throw buildDiagnostics.NUXT_B1021({ export: componentExport })
          }
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
            const name = params.get('nuxt_component_name')
            return {
              code: [
                `import { createServerComponent } from ${JSON.stringify(options.serverComponentRuntime)}`,
                `${exportWording} createServerComponent(${JSON.stringify(name)})`,
              ].join('\n'),
              map: null,
            }
          } else {
            throw buildDiagnostics.NUXT_B1019({ mode: String(mode) })
          }
        },
      },
    },
    {
      name: 'nuxt:components:imports-alias',
      enforce: 'post',
      transformInclude (id) {
        id = normalize(id)
        return id.startsWith('virtual:') || id.startsWith('\0virtual:') || id.startsWith(nuxt.options.buildDir) || !isIgnored(id, undefined, nuxt)
      },
      transform: {
        filter: {
          code: /#components/,
        },
        async handler (code, id) {
          // If package defines a "#components" import mapping, assume is used internally by the package.
          if (await hasOwnSubpathImport(id, '#components', nuxt.options.rootDir)) {
            return
          }

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
      },
    },
  ])
}
