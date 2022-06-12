import { pathToFileURL } from 'node:url'
import { createUnplugin } from 'unplugin'
import { parseQuery, parseURL } from 'ufo'
import { Component, ComponentsOptions } from '@nuxt/schema'
import { genDynamicImport, genImport } from 'knitwork'
import MagicString from 'magic-string'
import { pascalCase } from 'scule'

interface LoaderOptions {
  getComponents(): Component[]
  mode: 'server' | 'client'
  sourcemap?: boolean
  transform?: ComponentsOptions['transform']
}

export const loaderPlugin = createUnplugin((options: LoaderOptions) => {
  const exclude = options.transform?.exclude || []
  const include = options.transform?.include || []

  return {
    name: 'nuxt:components-loader',
    enforce: 'post',
    transformInclude (id) {
      if (exclude.some(pattern => id.match(pattern))) {
        return false
      }
      if (include.some(pattern => id.match(pattern))) {
        return true
      }

      const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      const query = parseQuery(search)
      // we only transform render functions
      // from `type=template` (in Webpack) and bare `.vue` file (in Vite)
      return pathname.endsWith('.vue') && (query.type === 'template' || !!query.macro || !search)
    },
    transform (code, id) {
      const components = options.getComponents()

      let num = 0
      const imports = new Set<string>()
      const map = new Map<Component, string>()
      const s = new MagicString(code)

      // replace `_resolveComponent("...")` to direct import
      s.replace(/(?<=[ (])_?resolveComponent\(\s*["'](lazy-|Lazy)?([^'"]*?)["'][\s,]*\)/g, (full, lazy, name) => {
        const component = findComponent(components, name, options.mode)
        if (component) {
          const identifier = map.get(component) || `__nuxt_component_${num++}`
          map.set(component, identifier)
          const isClientOnly = component.mode === 'client'
          if (isClientOnly) {
            imports.add(genImport('#app/components/client-only', [{ name: 'createClientOnly' }]))
          }
          if (lazy) {
            imports.add(genImport('vue', [{ name: 'defineAsyncComponent', as: '__defineAsyncComponent' }]))
            imports.add(`const ${identifier}_lazy = __defineAsyncComponent(${genDynamicImport(component.filePath)})`)
            return isClientOnly ? `createClientOnly(${identifier}_lazy)` : `${identifier}_lazy`
          } else {
            imports.add(genImport(component.filePath, [{ name: component.export, as: identifier }]))
            return isClientOnly ? `createClientOnly(${identifier})` : identifier
          }
        }
        // no matched
        return full
      })

      if (imports.size) {
        s.prepend([...imports, ''].join('\n'))
      }

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: options.sourcemap && s.generateMap({ source: id, includeContent: true })
        }
      }
    }
  }
})

function findComponent (components: Component[], name: string, mode: LoaderOptions['mode']) {
  const id = pascalCase(name).replace(/["']/g, '')
  const component = components.find(component => id === component.pascalName && ['all', mode, undefined].includes(component.mode))
  if (!component && components.some(component => id === component.pascalName)) {
    return components.find(component => component.pascalName === 'ServerPlaceholder')
  }
  return component
}
