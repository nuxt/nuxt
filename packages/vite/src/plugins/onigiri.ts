import type { Plugin } from 'vite'
import type { Component, Nuxt } from '@nuxt/schema'
import { onigiriPlugins } from 'vue-onigiri/vite'

interface ComponentImport {
  path: string
  export?: string
}

const PATH_SPECIFIER_RE = /^(?:[/.]|[a-z]:[\\/])/i

/**
 * vue-onigiri's scan, compiler and manifest plugins, fed with the components Nuxt registers.
 * Empty unless `experimental.componentIslands` is `'vue-onigiri'`.
 */
export function OnigiriPlugins (nuxt: Nuxt): Plugin[] {
  if (nuxt.options.experimental.componentIslands !== 'vue-onigiri') {
    return []
  }

  const componentImports = new Map<string, ComponentImport>()
  // Derived from `componentImports` on every update; the manifest plugin reads it at load time.
  const extraEntries: Record<string, string> = {}

  const setComponents = (components: Iterable<Component>) => {
    componentImports.clear()
    for (const key in extraEntries) {
      delete extraEntries[key]
    }
    for (const component of components) {
      if (!component.pascalName || !component.filePath || component._raw) { continue }
      const path = component.filePath.replaceAll('\\', '/')
      componentImports.set(component.pascalName, { path, export: component.export })
      // package components only; app files are globbed
      if (!PATH_SPECIFIER_RE.test(path)) {
        extraEntries[path] = path
      }
    }
  }

  setComponents(Object.values(nuxt.apps).flatMap(app => app.components ?? []))
  nuxt.hook('components:extend', setComponents)

  return [
    ...onigiriPlugins({
      additionalImports: () => componentImports,
      clientInclude: 'auto',
      serverInclude: ['auto', '/pages/**/*.vue'],
      extraEntries,
    }),
    {
      name: 'nuxt:onigiri',
      // The loader imports `vue-onigiri/manifest`, a stub the manifest plugin replaces by id;
      // externalized, Node would load the stub, which throws at request time.
      config: () => ({ ssr: { noExternal: ['vue-onigiri'] } }),
    },
  ]
}
