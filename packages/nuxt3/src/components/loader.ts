import { createUnplugin } from 'unplugin'
import { parseQuery, parseURL } from 'ufo'
import { Component } from '@nuxt/schema'
import { genImport } from 'knitwork'

interface LoaderOptions {
  getComponents(): Component[]
}

export const loaderPlugin = createUnplugin((options: LoaderOptions) => ({
  name: 'nuxt:components-loader',
  enforce: 'post',
  transformInclude (id) {
    const { pathname, search } = parseURL(id)
    const query = parseQuery(search)
    // we only transform render functions
    // from `type=template` (in Webpack) and bare `.vue` file (in Vite)
    return pathname.endsWith('.vue') && (query.type === 'template' || !search)
  },
  transform (code) {
    return transform(code, options.getComponents())
  }
}))

function findComponent (components: Component[], name:string) {
  return components.find(({ pascalName, kebabName }) => [pascalName, kebabName].includes(name))
}

function transform (content: string, components: Component[]) {
  let num = 0
  let imports = ''
  const map = new Map<Component, string>()

  // replace `_resolveComponent("...")` to direct import
  const newContent = content.replace(/ _resolveComponent\("(.*?)"\)/g, (full, name) => {
    const component = findComponent(components, name)
    if (component) {
      const identifier = map.get(component) || `__nuxt_component_${num++}`
      map.set(component, identifier)
      imports += genImport(component.filePath, [{ name: component.export, as: identifier }])
      return ` ${identifier}`
    }
    // no matched
    return full
  })

  if (!imports || newContent === content) { return }

  return `${imports}\n${newContent}`
}
