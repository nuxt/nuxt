import { createUnplugin } from 'unplugin'
import { genDynamicImport, genImport } from 'knitwork'
import { normalize, relative } from 'pathe'
import escapeStringRegexp from 'escape-string-regexp'

import { COMPONENT_WRAPPER_PREFIX } from '../compiler-resolver.ts'
import type { ComponentResolver } from '../compiler-resolver.ts'

interface ComponentWrapperPluginOptions {
  resolver: ComponentResolver
  mode: 'client' | 'server'
  srcDir: string
  serverComponentRuntime: string
  clientDelayedComponentRuntime: string
  refreshComponents?: (file: string, timestamp: number) => void | Promise<void>
}

// unplugin's webpack adapter normalises the leading `/` to `\` on Windows
const WRAPPER_ID_RE = new RegExp('^[\\\\/]' + escapeStringRegexp(COMPONENT_WRAPPER_PREFIX.slice(1)))
const RESOLVED_WRAPPER_ID_RE = new RegExp('^\0' + escapeStringRegexp(COMPONENT_WRAPPER_PREFIX))

/**
 * Serves the modules imported by templates compiled with the component resolver
 * for server, client-only and lazy components, and invalidates templates whose
 * tags resolve differently after a component file is added or removed.
 */
export const ComponentWrapperPlugin = (options: ComponentWrapperPluginOptions) => createUnplugin(() => {
  const resolutions = options.resolver.resolutions[options.mode]

  return {
    name: 'nuxt:component-wrappers',
    enforce: 'pre',
    resolveId: {
      filter: { id: WRAPPER_ID_RE },
      handler (id) {
        return '\0/' + id.slice(1)
      },
    },
    load: {
      filter: { id: RESOLVED_WRAPPER_ID_RE },
      handler (id) {
        const wrapper = options.resolver.getWrapper(id.slice(1))
        if (!wrapper) { return }
        const { component } = wrapper

        if (wrapper.kind === 'server') {
          return [
            genImport(options.serverComponentRuntime, ['createServerComponent']),
            `export default createServerComponent(${JSON.stringify(component.pascalName)})`,
          ].join('\n')
        }

        if (wrapper.kind === 'client') {
          return [
            genImport('#app/components/client-only', ['createClientOnly']),
            genImport(component.filePath, [{ name: component.export ?? 'default', as: '__component' }]),
            'export default createClientOnly(__component)',
          ].join('\n')
        }

        const loader = `${genDynamicImport(component.filePath, { interopDefault: false })}.then(c => c.${component.export ?? 'default'} || c)`
        if (wrapper.kind === 'lazy') {
          return [
            genImport('vue', ['defineAsyncComponent']),
            ...wrapper.clientOnly ? [genImport('#app/components/client-only', ['createClientOnly'])] : [],
            `export default defineAsyncComponent(${loader}${wrapper.clientOnly ? '.then(c => createClientOnly(c))' : ''})`,
          ].join('\n')
        }

        const factory = `createLazy${wrapper.kind.slice('lazy-'.length)}Component`
        return [
          genImport(options.clientDelayedComponentRuntime, [factory]),
          `export default ${factory}(${JSON.stringify(relative(options.srcDir, component.filePath))}, ${loader})`,
        ].join('\n')
      },
    },
    vite: {
      hotUpdate: {
        order: 'pre',
        async handler ({ type, file, timestamp, modules }) {
          if (type === 'update' || !options.refreshComponents) { return }
          const pending = options.refreshComponents(normalize(file), timestamp)
          if (!pending) { return }
          await pending

          const affected = new Set(modules)
          for (const [id, tags] of resolutions) {
            for (const [tag, key] of tags) {
              if (options.resolver.resolutionKey(options.resolver.resolveTag(tag, options.mode, id)) === key) { continue }
              const mod = this.environment.moduleGraph.getModuleById(id)
              if (mod) {
                affected.add(mod)
              } else {
                resolutions.delete(id)
              }
              break
            }
          }
          if (affected.size !== modules.length) {
            return [...affected]
          }
        },
      },
    },
  }
})
