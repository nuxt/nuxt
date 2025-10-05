import { isAbsolute, join, relative, resolve } from 'pathe'
import { genDynamicImport } from 'knitwork'
import { distDir } from '../dirs'
import type { NuxtApp, NuxtPluginTemplate, NuxtTemplate } from 'nuxt/schema'

type ImportMagicCommentsOptions = {
  chunkName: string
  prefetch?: boolean | number
  preload?: boolean | number
}

const createImportMagicComments = (options: ImportMagicCommentsOptions) => {
  const { chunkName, prefetch, preload } = options
  return [
    `webpackChunkName: "${chunkName}"`,
    prefetch === true || typeof prefetch === 'number' ? `webpackPrefetch: ${prefetch}` : false,
    preload === true || typeof preload === 'number' ? `webpackPreload: ${preload}` : false,
  ].filter(Boolean).join(', ')
}

const emptyComponentsPlugin = `
import { defineNuxtPlugin } from '#app/nuxt'
export default defineNuxtPlugin({
  name: 'nuxt:global-components',
})
`

export const componentsPluginTemplate: NuxtPluginTemplate = {
  filename: 'components.plugin.mjs',
  getContents ({ app }) {
    const lazyGlobalComponents = new Set<string>()
    const syncGlobalComponents = new Set<string>()
    for (const component of app.components) {
      if (component.global === 'sync') {
        syncGlobalComponents.add(component.pascalName)
      } else if (component.global) {
        lazyGlobalComponents.add(component.pascalName)
      }
    }
    if (!lazyGlobalComponents.size && !syncGlobalComponents.size) { return emptyComponentsPlugin }

    const lazyComponents = [...lazyGlobalComponents]
    const syncComponents = [...syncGlobalComponents]

    return `import { defineNuxtPlugin } from '#app/nuxt'
import { ${[...lazyComponents.map(c => 'Lazy' + c), ...syncComponents].join(', ')} } from '#components'
const lazyGlobalComponents = [
  ${lazyComponents.map(c => `["${c}", Lazy${c}]`).join(',\n')},
  ${syncComponents.map(c => `["${c}", ${c}]`).join(',\n')}
]

export default defineNuxtPlugin({
  name: 'nuxt:global-components',
  setup (nuxtApp) {
    for (const [name, component] of lazyGlobalComponents) {
      nuxtApp.vueApp.component(name, component)
      nuxtApp.vueApp.component('Lazy' + name, component)
    }
  }
})
`
  },
}

export const componentNamesTemplate: NuxtTemplate = {
  filename: 'component-names.mjs',
  getContents ({ app }) {
    const componentNames = new Set<string>()
    for (const c of app.components) {
      if (!c.island) {
        componentNames.add(c.pascalName)
      }
    }
    return `export const componentNames = ${JSON.stringify([...componentNames])}`
  },
}

export const componentsIslandsTemplate: NuxtTemplate = {
  // components.islands.mjs'
  getContents ({ app, nuxt }) {
    if (!nuxt.options.experimental.componentIslands) {
      return 'export const islandComponents = {}'
    }

    const components = app.components
    const pages = app.pages
    const islands = components.filter(component =>
      component.island ||
      // .server components without a corresponding .client component will need to be rendered as an island
      (component.mode === 'server' && !components.some(c => c.pascalName === component.pascalName && c.mode === 'client')),
    )

    const pageExports = pages?.filter(p => (p.mode === 'server' && p.file && p.name)).map((p) => {
      return `"page_${p.name}": defineAsyncComponent(${genDynamicImport('virtual:vsc:' + p.file!)}.then(c => c.default || c))`
    }) || []

    return [
      'import { defineAsyncComponent } from \'vue\'',
      'export const islandComponents = import.meta.client ? {} : {',
      islands.map(
        (c) => {
          const exp = c.export === 'default' ? 'c.default || c' : `c['${c.export}']`
          const comment = createImportMagicComments(c)
          return `  "${c.pascalName}": defineAsyncComponent(${genDynamicImport('virtual:vsc:' + c.filePath, { comment })}.then(c => ${exp}))`
        },
      ).concat(pageExports).join(',\n'),
      '}',
    ].join('\n')
  },
}

export const bento: NuxtTemplate = {
  // components.islands.mjs'
  getContents () {
    return `export * from "vue-onigiri/runtime/deserialize"`
  },
  write: true
}

const NON_VUE_RE = /\b\.(?!vue)\w+$/g
function resolveComponentTypes (app: NuxtApp, baseDir: string) {
  const serverPlaceholderPath = resolve(distDir, 'app/components/server-placeholder')
  const componentTypes: Array<[string, string]> = []
  for (const c of app.components) {
    if (c.island) {
      continue
    }
    let type = `typeof ${
      genDynamicImport(isAbsolute(c.filePath)
        ? relative(baseDir, c.filePath).replace(NON_VUE_RE, '')
        : c.filePath.replace(NON_VUE_RE, ''), { wrapper: false })
    }['${c.export}']`

    if (c.mode === 'server') {
      if (app.components.some(other => other.pascalName === c.pascalName && other.mode === 'client')) {
        if (c.filePath.startsWith(serverPlaceholderPath)) {
          continue
        }
      } else {
        type = `IslandComponent<${type}>`
      }
    }
    componentTypes.push([c.pascalName, type])
  }

  return componentTypes
}

const islandType = 'type IslandComponent<T> = DefineComponent<{}, {refresh: () => Promise<void>}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, SlotsType<{ fallback: { error: unknown } }>> & T'
const hydrationTypes = `
type HydrationStrategies = {
  hydrateOnVisible?: IntersectionObserverInit | true
  hydrateOnIdle?: number | true
  hydrateOnInteraction?: keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap> | true
  hydrateOnMediaQuery?: string
  hydrateAfter?: number
  hydrateWhen?: boolean
  hydrateNever?: true
}
type LazyComponent<T> = DefineComponent<HydrationStrategies, {}, {}, {}, {}, {}, {}, { hydrated: () => void }> & T
`
export const componentsDeclarationTemplate = {
  filename: 'components.d.ts' as const,
  write: true,
  getContents: ({ app, nuxt }) => {
    const componentTypes = resolveComponentTypes(app, nuxt.options.buildDir)
    return `
import type { DefineComponent, SlotsType } from 'vue'
${nuxt.options.experimental.componentIslands ? islandType : ''}
${hydrationTypes}

${componentTypes.map(([pascalName, type]) => `export const ${pascalName}: ${type}`).join('\n')}
${componentTypes.map(([pascalName, type]) => `export const Lazy${pascalName}: LazyComponent<${type}>`).join('\n')}

export const componentNames: string[]
`
  },
} satisfies NuxtTemplate

export const componentsTypeTemplate = {
  filename: 'types/components.d.ts' as const,
  getContents: ({ app, nuxt }) => {
    const componentTypes = resolveComponentTypes(app, join(nuxt.options.buildDir, 'types'))
    return `
import type { DefineComponent, SlotsType } from 'vue'
${nuxt.options.experimental.componentIslands ? islandType : ''}
${hydrationTypes}
interface _GlobalComponents {
${componentTypes.map(([pascalName, type]) => `  '${pascalName}': ${type}`).join('\n')}
${componentTypes.map(([pascalName, type]) => `  'Lazy${pascalName}': LazyComponent<${type}>`).join('\n')}
}

declare module 'vue' {
  export interface GlobalComponents extends _GlobalComponents { }
}

export {}
`
  },
} satisfies NuxtTemplate

export const componentsMetadataTemplate: NuxtTemplate = {
  filename: 'components.json',
  write: true,
  getContents: ({ app }) => JSON.stringify(app.components, null, 2),
}
