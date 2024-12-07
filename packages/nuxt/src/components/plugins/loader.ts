import { createUnplugin } from 'unplugin'
import { genDynamicImport, genImport } from 'knitwork'
import MagicString from 'magic-string'
import { pascalCase } from 'scule'
import { relative } from 'pathe'
import type { Component, ComponentsOptions } from 'nuxt/schema'

import { logger, tryUseNuxt } from '@nuxt/kit'
import { QUOTE_RE, SX_RE, isVue } from '../../core/utils'

interface LoaderOptions {
  getComponents (): Component[]
  mode: 'server' | 'client'
  serverComponentRuntime: string
  clientDelayedComponentRuntime: string
  sourcemap?: boolean
  transform?: ComponentsOptions['transform']
  experimentalComponentIslands?: boolean
}

const REPLACE_COMPONENT_TO_DIRECT_IMPORT_RE = /(?<=[ (])_?resolveComponent\(\s*["'](lazy-|Lazy(?=[A-Z]))?(Idle|Visible|idle-|visible-|Event|event-|Media|media-|If|if-|Never|never-|Time|time-|Promise|promise-)?([^'"]*)["'][^)]*\)/g
export const LoaderPlugin = (options: LoaderOptions) => createUnplugin(() => {
  const exclude = options.transform?.exclude || []
  const include = options.transform?.include || []
  const nuxt = tryUseNuxt()

  return {
    name: 'nuxt:components-loader',
    enforce: 'post',
    transformInclude (id) {
      if (exclude.some(pattern => pattern.test(id))) {
        return false
      }
      if (include.some(pattern => pattern.test(id))) {
        return true
      }
      return isVue(id, { type: ['template', 'script'] }) || !!id.match(SX_RE)
    },
    transform (code, id) {
      const components = options.getComponents()

      let num = 0
      const imports = new Set<string>()
      const map = new Map<Component, string>()
      const s = new MagicString(code)
      // replace `_resolveComponent("...")` to direct import
      s.replace(REPLACE_COMPONENT_TO_DIRECT_IMPORT_RE, (full: string, lazy: string, modifier: string, name: string) => {
        const normalComponent = findComponent(components, name, options.mode)
        const modifierComponent = !normalComponent && modifier ? findComponent(components, modifier + name, options.mode) : null
        const component = normalComponent || modifierComponent

        if (component) {
          const internalInstall = ((component as any)._internal_install) as string
          if (internalInstall && nuxt?.options.test === false) {
            if (!nuxt.options.dev) {
              const relativePath = relative(nuxt.options.rootDir, id)
              throw new Error(`[nuxt] \`~/${relativePath}\` is using \`${component.pascalName}\` which requires \`${internalInstall}\``)
            }
            import('../../core/features').then(({ installNuxtModule }) => installNuxtModule(internalInstall))
          }
          let identifier = map.get(component) || `__nuxt_component_${num++}`
          map.set(component, identifier)

          const isServerOnly = !component._raw && component.mode === 'server' &&
            !components.some(c => c.pascalName === component.pascalName && c.mode === 'client')
          if (isServerOnly) {
            imports.add(genImport(options.serverComponentRuntime, [{ name: 'createServerComponent' }]))
            imports.add(`const ${identifier} = createServerComponent(${JSON.stringify(component.pascalName)})`)
            if (!options.experimentalComponentIslands) {
              logger.warn(`Standalone server components (\`${name}\`) are not yet supported without enabling \`experimental.componentIslands\`.`)
            }
            return identifier
          }

          const isClientOnly = !component._raw && component.mode === 'client'
          if (isClientOnly) {
            imports.add(genImport('#app/components/client-only', [{ name: 'createClientOnly' }]))
            identifier += '_client'
          }

          if (lazy) {
            const dynamicImport = `${genDynamicImport(component.filePath, { interopDefault: false })}.then(c => c.${component.export ?? 'default'} || c)`
            if (modifier && normalComponent && nuxt?.options.experimental.delayedHydration === true) {
              switch (modifier) {
                case 'Visible':
                case 'visible-':
                  imports.add(genImport(options.clientDelayedComponentRuntime, [{ name: 'createLazyIOComponent' }]))
                  identifier += '_delayedIO'
                  imports.add(`const ${identifier} = createLazyIOComponent(${dynamicImport})`)
                  break
                case 'Event':
                case 'event-':
                  imports.add(genImport(options.clientDelayedComponentRuntime, [{ name: 'createLazyEventComponent' }]))
                  identifier += '_delayedEvent'
                  imports.add(`const ${identifier} = createLazyEventComponent(${dynamicImport})`)
                  break
                case 'Idle':
                case 'idle-':
                  imports.add(genImport(options.clientDelayedComponentRuntime, [{ name: 'createLazyNetworkComponent' }]))
                  identifier += '_delayedNetwork'
                  imports.add(`const ${identifier} = createLazyNetworkComponent(${dynamicImport})`)
                  break
                case 'Media':
                case 'media-':
                  imports.add(genImport(options.clientDelayedComponentRuntime, [{ name: 'createLazyMediaComponent' }]))
                  identifier += '_delayedMedia'
                  imports.add(`const ${identifier} = createLazyMediaComponent(${dynamicImport})`)
                  break
                case 'If':
                case 'if-':
                  imports.add(genImport(options.clientDelayedComponentRuntime, [{ name: 'createLazyIfComponent' }]))
                  identifier += '_delayedIf'
                  imports.add(`const ${identifier} = createLazyIfComponent(${dynamicImport})`)
                  break
                case 'Never':
                case 'never-':
                  imports.add(genImport('vue', [{ name: 'defineAsyncComponent', as: '__defineAsyncComponent' }]))
                  identifier += '_delayedNever'
                  imports.add(`const ${identifier} = __defineAsyncComponent({loader: ${dynamicImport}, hydrate: () => {}})`)
                  break
                case 'Time':
                case 'time-':
                  imports.add(genImport(options.clientDelayedComponentRuntime, [{ name: 'createLazyTimeComponent' }]))
                  identifier += '_delayedTime'
                  imports.add(`const ${identifier} = createLazyTimeComponent(${dynamicImport})`)
                  break
                case 'Promise':
                case 'promise-':
                  imports.add(genImport(options.clientDelayedComponentRuntime, [{ name: 'createLazyPromiseComponent' }]))
                  identifier += '_delayedPromise'
                  imports.add(`const ${identifier} = createLazyPromiseComponent(${dynamicImport})`)
                  break
              }
            } else {
              imports.add(genImport('vue', [{ name: 'defineAsyncComponent', as: '__defineAsyncComponent' }]))
              identifier += '_lazy'
              imports.add(`const ${identifier} = __defineAsyncComponent(${dynamicImport}${isClientOnly ? '.then(c => createClientOnly(c))' : ''})`)
            }
          } else {
            imports.add(genImport(component.filePath, [{ name: component._raw ? 'default' : component.export, as: identifier }]))

            if (isClientOnly) {
              imports.add(`const ${identifier}_wrapped = createClientOnly(${identifier})`)
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
            ? s.generateMap({ hires: true })
            : undefined,
        }
      }
    },
  }
})

function findComponent (components: Component[], name: string, mode: LoaderOptions['mode']) {
  const id = pascalCase(name).replace(QUOTE_RE, '')
  // Prefer exact match
  const component = components.find(component => id === component.pascalName && ['all', mode, undefined].includes(component.mode))
  if (component) { return component }

  const otherModeComponent = components.find(component => id === component.pascalName)

  // Render client-only components on the server with <ServerPlaceholder> (a simple div)
  if (mode === 'server' && otherModeComponent) {
    return components.find(c => c.pascalName === 'ServerPlaceholder')
  }

  // Return the other-mode component in all other cases - we'll handle createClientOnly
  // and createServerComponent above
  return otherModeComponent
}
