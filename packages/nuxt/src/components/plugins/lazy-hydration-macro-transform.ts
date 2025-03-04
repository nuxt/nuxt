import { createUnplugin } from 'unplugin'
import type { Component, ComponentsOptions, NuxtTypeTemplate } from 'nuxt/schema'
import { relative } from 'pathe'

import MagicString from 'magic-string'
import { genDynamicImport, genImport } from 'knitwork'
import { pascalCase } from 'scule'
import { isJS, isVue } from '../../core/utils'

interface LoaderOptions {
  getComponents (): Component[]
  srcDir: string
  sourcemap?: boolean
  transform?: ComponentsOptions['transform']
  clientDelayedComponentRuntime: string
}

const LAZY_HYDRATION_MACRO_RE = /(?:const\s+(\w+)\s*=\s*)?defineLazy(Idle|Visible|Interaction|MediaQuery|Time|If|Never)Component\(\(\)\s*=>\s*import\(['"](.+?)['"]\)\)/g
const COMPONENT_NAME = /import\(["'].*\/([^\\/]+?)\.\w+["']\)/

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

    transform (code) {
      const matches = Array.from(code.matchAll(LAZY_HYDRATION_MACRO_RE))
      if (!matches.length) { return }

      const s = new MagicString(code)
      const names = new Set<string>()

      const components = options.getComponents()

      for (const match of matches) {
        const [matchedString, variableName, hydrationMode] = match

        const startIndex = match.index
        const endIndex = startIndex + matchedString.length

        if (!variableName) {
          s.remove(startIndex, endIndex)
          continue
        }

        const componentNameMatch = matchedString.match(COMPONENT_NAME)
        if (!componentNameMatch || !componentNameMatch[1]) {
          s.remove(startIndex, endIndex)
          continue
        }

        const name = componentNameMatch[1]
        const component = findComponent(components, name)
        if (!component) {
          s.remove(startIndex, endIndex)
          continue
        }

        const relativePath = relative(options.srcDir, component.filePath)
        const dynamicImport = `${genDynamicImport(component.filePath, { interopDefault: false })}.then(c => c.${component.export ?? 'default'} || c)`
        const replacement = `const ${variableName} = createLazy${hydrationMode}Component(${JSON.stringify(relativePath)}, ${dynamicImport})`

        s.overwrite(startIndex, endIndex, replacement)
        names.add(`createLazy${hydrationMode}Component`)
      }

      if (names.size) {
        const imports = genImport(options.clientDelayedComponentRuntime, [...names].map(name => ({ name })))
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
  }
})

export const lazyHydrationMacroTypeTemplate: NuxtTypeTemplate = {
  filename: 'types/lazy-hydration-macro.d.ts',
  getContents () {
    return `import { AsyncComponentLoader, Component, ComponentPublicInstance, DefineComponent } from 'vue'
type LazyHydrationComponent<Props> = DefineComponent<Props, {}, {}, {}, {}, {}, {}, { hydrated: () => void }>

declare global {
  function defineLazyVisibleComponent<T extends Component = { new (): ComponentPublicInstance }>(source: AsyncComponentLoader<T>): T & LazyHydrationComponent<{ hydrateOnVisible?: IntersectionObserverInit | true }>;
  function defineLazyIdleComponent<T extends Component = { new (): ComponentPublicInstance }>(source: AsyncComponentLoader<T>): T & LazyHydrationComponent<{ hydrateOnIdle?: number | true }>;
  function defineLazyInteractionComponent<T extends Component = { new (): ComponentPublicInstance }>(source: AsyncComponentLoader<T>): T & LazyHydrationComponent<{ hydrateOnInteraction?: keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap> | true }>;
  function defineLazyMediaQueryComponent<T extends Component = { new (): ComponentPublicInstance }>(source: AsyncComponentLoader<T>): T & LazyHydrationComponent<{ hydrateOnMediaQuery: string }>;
  function defineLazyIfComponent<T extends Component = { new (): ComponentPublicInstance }>(source: AsyncComponentLoader<T>): T & LazyHydrationComponent<{ hydrateWhen?: boolean }>;
  function defineLazyTimeComponent<T extends Component = { new (): ComponentPublicInstance }>(source: AsyncComponentLoader<T>): T & LazyHydrationComponent<{ hydrateAfter: number | true }>;
  function defineLazyNeverComponent<T extends Component = { new (): ComponentPublicInstance }>(source: AsyncComponentLoader<T>): T & LazyHydrationComponent<{ hydrateNever?: true }>;
}
`
  },
}

function findComponent (components: Component[], name: string) {
  const id = pascalCase(name)
  return components.find(c => c.pascalName === id)
}
