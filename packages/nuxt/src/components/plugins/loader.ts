import { createUnplugin } from 'unplugin'
import { genDynamicImport, genImport } from 'knitwork'
import MagicString from 'magic-string'
import { pascalCase } from 'scule'
import { relative } from 'pathe'
import type { Component, ComponentsOptions } from 'nuxt/schema'

import { tryUseNuxt } from '@nuxt/kit'
import { QUOTE_RE, SX_RE, isVue } from '../../core/utils'
import { installNuxtModule } from '../../core/features'
import { logger } from '../../utils'

interface LoaderOptions {
  getComponents (): Component[]
  mode: 'server' | 'client'
  srcDir: string
  serverComponentRuntime: string
  clientDelayedComponentRuntime: string
  sourcemap?: boolean
  transform?: ComponentsOptions['transform']
  experimentalComponentIslands?: boolean
}

const REPLACE_COMPONENT_TO_DIRECT_IMPORT_RE = /(?<=[ (])_?resolveComponent\(\s*(?<quote>["'`])(?<lazy>lazy-|Lazy(?=[A-Z]))?(?<modifier>Idle|Visible|idle-|visible-|Interaction|interaction-|MediaQuery|media-query-|If|if-|Never|never-|Time|time-)?(?<name>[^'"`]*)\k<quote>[^)]*\)/g
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
      s.replace(REPLACE_COMPONENT_TO_DIRECT_IMPORT_RE, (full: string, ...args) => {
        const { lazy, modifier, name } = args.pop()
        const normalComponent = findComponent(components, name, options.mode)
        const modifierComponent = !normalComponent && modifier ? findComponent(components, modifier + name, options.mode) : null
        const component = normalComponent || modifierComponent

        if (component) {
          // TODO: refactor to nuxi
          const internalInstall = ((component as any)._internal_install) as string
          if (internalInstall && nuxt?.options.test === false) {
            if (!nuxt.options.dev) {
              const relativePath = relative(nuxt.options.rootDir, id)
              throw new Error(`[nuxt] \`~/${relativePath}\` is using \`${component.pascalName}\` which requires \`${internalInstall}\``)
            }
            installNuxtModule(internalInstall)
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
            if (modifier && normalComponent) {
              const relativePath = relative(options.srcDir, component.filePath)
              switch (modifier) {
                case 'Visible':
                case 'visible-':
                  imports.add(genImport(options.clientDelayedComponentRuntime, [{ name: 'createLazyVisibleComponent' }]))
                  identifier += '_lazy_visible'
                  imports.add(`const ${identifier} = createLazyVisibleComponent(${JSON.stringify(relativePath)}, ${dynamicImport})`)
                  break
                case 'Interaction':
                case 'interaction-':
                  imports.add(genImport(options.clientDelayedComponentRuntime, [{ name: 'createLazyInteractionComponent' }]))
                  identifier += '_lazy_event'
                  imports.add(`const ${identifier} = createLazyInteractionComponent(${JSON.stringify(relativePath)}, ${dynamicImport})`)
                  break
                case 'Idle':
                case 'idle-':
                  imports.add(genImport(options.clientDelayedComponentRuntime, [{ name: 'createLazyIdleComponent' }]))
                  identifier += '_lazy_idle'
                  imports.add(`const ${identifier} = createLazyIdleComponent(${JSON.stringify(relativePath)}, ${dynamicImport})`)
                  break
                case 'MediaQuery':
                case 'media-query-':
                  imports.add(genImport(options.clientDelayedComponentRuntime, [{ name: 'createLazyMediaQueryComponent' }]))
                  identifier += '_lazy_media'
                  imports.add(`const ${identifier} = createLazyMediaQueryComponent(${JSON.stringify(relativePath)}, ${dynamicImport})`)
                  break
                case 'If':
                case 'if-':
                  imports.add(genImport(options.clientDelayedComponentRuntime, [{ name: 'createLazyIfComponent' }]))
                  identifier += '_lazy_if'
                  imports.add(`const ${identifier} = createLazyIfComponent(${JSON.stringify(relativePath)}, ${dynamicImport})`)
                  break
                case 'Never':
                case 'never-':
                  imports.add(genImport(options.clientDelayedComponentRuntime, [{ name: 'createLazyNeverComponent' }]))
                  identifier += '_lazy_never'
                  imports.add(`const ${identifier} = createLazyNeverComponent(${JSON.stringify(relativePath)}, ${dynamicImport})`)
                  break
                case 'Time':
                case 'time-':
                  imports.add(genImport(options.clientDelayedComponentRuntime, [{ name: 'createLazyTimeComponent' }]))
                  identifier += '_lazy_time'
                  imports.add(`const ${identifier} = createLazyTimeComponent(${JSON.stringify(relativePath)}, ${dynamicImport})`)
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
  const validModes = new Set(['all', mode, undefined])
  const component = components.find(component => id === component.pascalName && validModes.has(component.mode))
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
