import { createUnplugin } from 'unplugin'
import { relative } from 'pathe'

import MagicString from 'magic-string'
import { genDynamicImport, genImport } from 'knitwork'
import { pascalCase, upperFirst } from 'scule'
import { isJS, isVue } from '../../core/utils'
import type { Component, ComponentsOptions } from 'nuxt/schema'

interface LoaderOptions {
  getComponents (): Component[]
  srcDir: string
  sourcemap?: boolean
  transform?: ComponentsOptions['transform']
  clientDelayedComponentRuntime: string
}

const LAZY_HYDRATION_MACRO_RE = /(?:\b(?:const|let|var)\s+(\w+)\s*=\s*)?defineLazyHydrationComponent\(\s*['"]([^'"]+)['"]\s*,\s*\(\s*\)\s*=>\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\)/g
const COMPONENT_NAME = /import\(["'].*\/([^\\/]+?)\.\w+["']\)/
const COMPONENT_IMPORT = /import\(["']([^'"]+)["']\)/
const HYDRATION_STRATEGY = ['visible', 'idle', 'interaction', 'mediaQuery', 'if', 'time', 'never']

export const LazyHydrationMacroTransformPlugin = (options: LoaderOptions) => createUnplugin(() => {
  const exclude = options.transform?.exclude || []
  const include = options.transform?.include || []

  return {
    name: 'nuxt:lazy-hydration-macro',
    enforce: 'post',
    transformInclude (id) {
      if (exclude.some(pattern => pattern.test(id))) {
        return false
      }
      if (include.some(pattern => pattern.test(id))) {
        return true
      }
      return isVue(id, { type: ['template', 'script'] }) || isJS(id)
    },

    transform: {
      filter: {
        code: { include: LAZY_HYDRATION_MACRO_RE },
      },

      handler (code) {
        const matches = Array.from(code.matchAll(LAZY_HYDRATION_MACRO_RE))
        if (!matches.length) { return }

        const s = new MagicString(code)
        const names = new Set<string>()

        const components = options.getComponents()

        for (const match of matches) {
          const [matchedString, variableName, hydrationStrategy] = match

          const startIndex = match.index
          const endIndex = startIndex + matchedString.length

          if (!variableName) {
            s.remove(startIndex, endIndex)
            continue
          }

          if (!hydrationStrategy || !HYDRATION_STRATEGY.includes(hydrationStrategy)) {
            s.remove(startIndex, endIndex)
            continue
          }

          const componentNameMatch = matchedString.match(COMPONENT_NAME)
          if (!componentNameMatch || !componentNameMatch[1]) {
            s.remove(startIndex, endIndex)
            continue
          }

          const name = componentNameMatch[1]
          let shouldUseRelativePathAsParam = true
          let component = findComponent(components, name)
          if (!component) {
            const componentImportPath = matchedString.match(COMPONENT_IMPORT)
            if(!componentImportPath || !componentImportPath[1]) {
              s.remove(startIndex, endIndex)
              continue
            }

            // Component is not auto imported, use source import path as is
            component = {
              filePath: componentImportPath[1],
              pascalName: pascalCase(name),
            } as Component
            shouldUseRelativePathAsParam = false
          }
          
          const relativePath = relative(options.srcDir, component.filePath)
          const dynamicImport = `${genDynamicImport(component.filePath, { interopDefault: false })}.then(c => c.${component.export ?? 'default'} || c)`
          const replaceFunctionName = `createLazy${upperFirst(hydrationStrategy)}Component`
          const replacement = `const ${variableName} = __${replaceFunctionName}(${JSON.stringify(shouldUseRelativePathAsParam ? relativePath : component.filePath)}, ${dynamicImport})`

          s.overwrite(startIndex, endIndex, replacement)
          names.add(replaceFunctionName)
        }

        if (names.size) {
          const imports = genImport(options.clientDelayedComponentRuntime, [...names].map(name => ({ name, as: `__${name}` })))
          s.prepend(imports)
        }

        if (s.hasChanged()) {
          return {
            code: s.toString(),
            map: options.sourcemap
              ? s.generateMap({ hires: true })
              : undefined,
          }
        }
      },
    },
  }
})

function findComponent (components: Component[], name: string) {
  const id = pascalCase(name)
  return components.find(c => c.pascalName === id)
}
