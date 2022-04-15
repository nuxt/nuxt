import { pathToFileURL } from 'node:url'
import { createUnplugin } from 'unplugin'
import { parseQuery, parseURL } from 'ufo'
import { Component } from '@nuxt/schema'
import { genDynamicImport, genImport } from 'knitwork'
import MagicString from 'magic-string'
import { pascalCase } from 'scule'

interface LoaderOptions {
  getComponents(): Component[]
}

export const loaderPlugin = createUnplugin((options: LoaderOptions) => ({
  name: 'nuxt:components-loader',
  enforce: 'post',
  transformInclude (id) {
    const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
    const query = parseQuery(search)
    // we only transform render functions
    // from `type=template` (in Webpack) and bare `.vue` file (in Vite)
    return pathname.endsWith('.vue') && (query.type === 'template' || !!query.macro || !search)
  },
  transform (code, id) {
    return transform(code, id, options.getComponents())
  }
}))

function findComponent (components: Component[], name: string) {
  const id = pascalCase(name).replace(/["']/g, '')
  return components.find(component => id === component.pascalName)
}

function transform (code: string, id: string, components: Component[]) {
  let num = 0
  const imports = new Set<string>()
  const map = new Map<Component, string>()
  const s = new MagicString(code)

  // replace `_resolveComponent("...")` to direct import
  s.replace(/(?<=[ (])_?resolveComponent\(["'](lazy-|Lazy)?([^'"]*?)["']\)/g, (full, lazy, name) => {
    const component = findComponent(components, name)
    if (component) {
      const identifier = map.get(component) || `__nuxt_component_${num++}`
      map.set(component, identifier)
      if (lazy) {
        // Nuxt will auto-import `defineAsyncComponent` for us
        imports.add(`const ${identifier}_lazy = defineAsyncComponent(${genDynamicImport(component.filePath)})`)
        return `${identifier}_lazy`
      } else {
        imports.add(genImport(component.filePath, [{ name: component.export, as: identifier }]))
        return identifier
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
      map: s.generateMap({ source: id, includeContent: true })
    }
  }
}
