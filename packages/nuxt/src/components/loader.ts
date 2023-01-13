import { pathToFileURL } from 'node:url'
import { createUnplugin } from 'unplugin'
import { parseQuery, parseURL } from 'ufo'
import type { Component, ComponentsOptions } from '@nuxt/schema'
import { genDynamicImport, genImport } from 'knitwork'
import MagicString from 'magic-string'
import { pascalCase } from 'scule'
import { resolve } from 'pathe'
import { distDir } from '../dirs'

interface LoaderOptions {
  getComponents (): Component[]
  mode: 'server' | 'client'
  sourcemap?: boolean
  transform?: ComponentsOptions['transform']
  experimentalComponentIslands?: boolean
}

function isVueTemplate (id: string) {
  // Bare `.vue` file (in Vite)
  if (id.endsWith('.vue')) {
    return true
  }

  const { search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
  if (!search) {
    return false
  }

  const query = parseQuery(search)

  // Macro
  if (query.macro) {
    return true
  }

  // Non-Vue or Styles
  if (!('vue' in query) || query.type === 'style') {
    return false
  }

  // Query `?vue&type=template` (in webpack or external template)
  return true
}

export const loaderPlugin = createUnplugin((options: LoaderOptions) => {
  const exclude = options.transform?.exclude || []
  const include = options.transform?.include || []
  const serverComponentRuntime = resolve(distDir, 'components/runtime/server-component')

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
      return isVueTemplate(id)
    },
    transform (code, id) {
      const components = options.getComponents()

      let num = 0
      const imports = new Set<string>()
      const map = new Map<Component, string>()
      const s = new MagicString(code)

      // replace `_resolveComponent("...")` to direct import
      s.replace(/(?<=[ (])_?resolveComponent\(\s*["'](lazy-|Lazy)?([^'"]*?)["'][\s,]*[^)]*\)/g, (full: string, lazy: string, name: string) => {
        const component = findComponent(components, name, options.mode)
        if (component) {
          let identifier = map.get(component) || `__nuxt_component_${num++}`
          map.set(component, identifier)

          const isServerOnly = component.mode === 'server' &&
            !components.some(c => c.pascalName === component.pascalName && c.mode === 'client')
          if (isServerOnly) {
            imports.add(genImport(serverComponentRuntime, [{ name: 'createServerComponent' }]))
            imports.add(`const ${identifier} = createServerComponent(${JSON.stringify(name)})`)
            if (!options.experimentalComponentIslands) {
              console.warn(`Standalone server components (\`${name}\`) are not yet supported without enabling \`experimental.componentIslands\`.`)
            }
            return identifier
          }

          const isClientOnly = component.mode === 'client'
          if (isClientOnly) {
            imports.add(genImport('#app/components/client-only', [{ name: 'createClientOnly' }]))
            identifier += '_client'
          }

          if (lazy) {
            imports.add(genImport('vue', [{ name: 'defineAsyncComponent', as: '__defineAsyncComponent' }]))
            identifier += '_lazy'
            imports.add(`const ${identifier} = /*#__PURE__*/ __defineAsyncComponent(${genDynamicImport(component.filePath, { interopDefault: true })}${isClientOnly ? '.then(c => createClientOnly(c))' : ''})`)
          } else {
            imports.add(genImport(component.filePath, [{ name: component.export, as: identifier }]))

            if (isClientOnly) {
              imports.add(`const ${identifier}_wrapped = /*#__PURE__*/ createClientOnly(${identifier})`)
              identifier += '_wrapped'
            }
          }

          return identifier
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
          map: options.sourcemap
            ? s.generateMap({ source: id, includeContent: true })
            : undefined
        }
      }
    }
  }
})

function findComponent (components: Component[], name: string, mode: LoaderOptions['mode']) {
  const id = pascalCase(name).replace(/["']/g, '')
  // Prefer exact match
  const component = components.find(component => id === component.pascalName && ['all', mode, undefined].includes(component.mode))
  if (component) { return component }

  // Render client-only components on the server with <ServerPlaceholder> (a simple div)
  if (mode === 'server' && !component) {
    return components.find(c => c.pascalName === 'ServerPlaceholder')
  }

  // Return the other-mode component in all other cases - we'll handle createClientOnly
  // and createServerComponent above
  return components.find(component => id === component.pascalName)
}
