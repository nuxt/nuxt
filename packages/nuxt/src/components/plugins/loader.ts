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
import { ScopeTracker, parseAndWalk } from '../../core/utils/parse'
import { LAZY_HYDRATION_MAGIC_COMMENT } from './lazy-hydration-macro-transform'

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
      const lazyHydrationImports = new Map<string, Set<string>>()
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
                case 'visible-': {
                  identifier += '_lazy_visible'
                  const importer = `const ${identifier} = createLazyVisibleComponent(${JSON.stringify(relativePath)}, ${dynamicImport})`
                  const set = (lazyHydrationImports.get('createLazyVisibleComponent') || new Set()).add(importer)
                  lazyHydrationImports.set('createLazyVisibleComponent', set)
                  break
                }
                case 'Interaction':
                case 'interaction-': {
                  identifier += '_lazy_event'
                  const importer = `const ${identifier} = createLazyInteractionComponent(${JSON.stringify(relativePath)}, ${dynamicImport})`
                  const set = (lazyHydrationImports.get('createLazyInteractionComponent') || new Set()).add(importer)
                  lazyHydrationImports.set('createLazyInteractionComponent', set)
                  break
                }
                case 'Idle':
                case 'idle-': {
                  identifier += '_lazy_idle'
                  const importer = `const ${identifier} = createLazyIdleComponent(${JSON.stringify(relativePath)}, ${dynamicImport})`
                  const set = (lazyHydrationImports.get('createLazyIdleComponent') || new Set()).add(importer)
                  lazyHydrationImports.set('createLazyIdleComponent', set)
                  break
                }
                case 'MediaQuery':
                case 'media-query-':{
                  identifier += '_lazy_media_query'
                  const importer = `const ${identifier} = createLazyMediaQueryComponent(${JSON.stringify(relativePath)}, ${dynamicImport})`
                  const set = (lazyHydrationImports.get('createLazyMediaQueryComponent') || new Set()).add(importer)
                  lazyHydrationImports.set('createLazyMediaQueryComponent', set)
                  break
                }
                case 'If':
                case 'if-': {
                  identifier += '_lazy_if'
                  const importer = `const ${identifier} = createLazyIfComponent(${JSON.stringify(relativePath)}, ${dynamicImport})`
                  const set = (lazyHydrationImports.get('createLazyIfComponent') || new Set()).add(importer)
                  lazyHydrationImports.set('createLazyIfComponent', set)
                  break
                }
                case 'Never':
                case 'never-': {
                  identifier += '_lazy_never'
                  const importer = `const ${identifier} = createLazyNeverComponent(${JSON.stringify(relativePath)}, ${dynamicImport})`
                  const set = (lazyHydrationImports.get('createLazyNeverComponent') || new Set()).add(importer)
                  lazyHydrationImports.set('createLazyNeverComponent', set)
                  break
                }
                case 'Time':
                case 'time-': {
                  identifier += '_lazy_time'
                  const importer = `const ${identifier} = createLazyTimeComponent(${JSON.stringify(relativePath)}, ${dynamicImport})`
                  const set = (lazyHydrationImports.get('createLazyTimeComponent') || new Set()).add(importer)
                  lazyHydrationImports.set('createLazyTimeComponent', set)
                  break
                }
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

      if (lazyHydrationImports.size) {
        let scopeTracker: ScopeTracker | undefined
        if (code.includes(LAZY_HYDRATION_MAGIC_COMMENT)) {
          scopeTracker = new ScopeTracker({ keepExitedScopes: true })
          parseAndWalk(code, id, { scopeTracker })
        }

        for (const [name, imps] of lazyHydrationImports) {
          s.prepend([
            ...(!scopeTracker?.isDeclared(name) ? [genImport(options.clientDelayedComponentRuntime, [{ name }])] : []),
            ...imps,
            '',
          ].join('\n'))
        }
      }

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
