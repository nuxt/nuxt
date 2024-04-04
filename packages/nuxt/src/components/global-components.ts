import { NuxtApp, NuxtPluginTemplate } from "@nuxt/schema"

interface GetGlobalComponentsType {
    lazyGlobalComponents: Set<string>
    syncGlobalComponents: Set<string>
}

export function getGlobalComponents(app: NuxtApp): GetGlobalComponentsType | null {
    const lazyGlobalComponents = new Set<string>()
    const syncGlobalComponents = new Set<string>()
    for (const component of app.components) {
      if (component.global === 'sync') {
        syncGlobalComponents.add(component.pascalName)
      } else if (component.global) {
        lazyGlobalComponents.add(component.pascalName)
      }
    }
    // will not be imported and be treeshaken
    if (!lazyGlobalComponents.size && !syncGlobalComponents.size) { return null }

    return {
        lazyGlobalComponents,
        syncGlobalComponents
    }
}

export const getComponentsPluginTemplate: (components: GetGlobalComponentsType) => NuxtPluginTemplate = ({lazyGlobalComponents, syncGlobalComponents}) => ({
  filename: 'components.plugin.mjs',
  write: true,
  getContents () {
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
  }
})