import { createUnplugin } from 'unplugin'
import { genDynamicImport, genImport } from 'knitwork'
import MagicString from 'magic-string'
import { camelCase, pascalCase } from 'scule'
import { relative } from 'pathe'
import type { Component, ComponentsOptions } from 'nuxt/schema'

import { tryUseNuxt } from '@nuxt/kit'
import { parse, walk } from 'ultrahtml'
import { QUOTE_RE, SX_RE, isVue } from '../../core/utils'
import { installNuxtModule } from '../../core/features'
import { logger } from '../../utils'

interface LoaderOptions {
  getComponents (): Component[]
  mode: 'server' | 'client'
  serverComponentRuntime: string
  clientDelayedComponentRuntime: string
  sourcemap?: boolean
  transform?: ComponentsOptions['transform']
  experimentalComponentIslands?: boolean
}

const TEMPLATE_RE = /<template>([\s\S]*)<\/template>/
const hydrationStrategyMap = {
  hydrateOnIdle: 'Idle',
  hydrateOnVisible: 'Visible',
  hydrateOnInteraction: 'Interaction',
  hydrateOnMediaQuery: 'MediaQuery',
  hydrateAfter: 'Time',
  hydrateWhen: 'If',
  hydrateNever: 'Never',
}
const LAZY_HYDRATION_PROPS_RE = /\bhydrate-?on-?idle|hydrate-?on-?visible|hydrate-?on-?interaction|hydrate-?on-?media-?query|hydrate-?after|hydrate-?when\b/
const REPLACE_COMPONENT_TO_DIRECT_IMPORT_RE = /(?<=[ (])_?resolveComponent\(\s*["'](lazy-|Lazy(?=[A-Z]))?(Idle|Visible|idle-|visible-|Interaction|interaction-|MediaQuery|media-query-|If|if-|Never|never-|Time|time-)?([^'"]*)["'][^)]*\)/g
export const LoaderPlugin = (options: LoaderOptions) => createUnplugin(() => {
  const exclude = options.transform?.exclude || []
  const include = options.transform?.include || []
  const nuxt = tryUseNuxt()

  return [
    {
      name: 'nuxt:components-loader-pre',
      enforce: 'pre',
      transformInclude (id) {
        if (exclude.some(pattern => pattern.test(id))) {
          return false
        }
        if (include.some(pattern => pattern.test(id))) {
          return true
        }
        return isVue(id, { type: ['template'] })
      },
      async transform (code) {
        // change <LazyMyComponent hydrate-on-idle /> to <LazyIdleMyComponent hydrate-on-idle />
        const { 0: template, index: offset = 0 } = code.match(TEMPLATE_RE) || {}
        if (!template) { return }
        if (!LAZY_HYDRATION_PROPS_RE.test(template)) {
          return
        }
        const s = new MagicString(code)
        try {
          const ast = parse(template)
          const components = options.getComponents()
          await walk(ast, (node) => {
            if (node.type !== 1 /* ELEMENT_NODE */) {
              return
            }
            if (!/^(?:Lazy|lazy-)/.test(node.name)) {
              return
            }
            const pascalName = pascalCase(node.name.slice(4))
            if (!components.some(c => c.pascalName === pascalName)) {
              // not auto-imported
              return
            }

            let strategy: string | undefined

            for (const attr in node.attributes) {
              const isDynamic = attr.startsWith(':')
              const prop = camelCase(isDynamic ? attr.slice(1) : attr)
              if (prop in hydrationStrategyMap) {
                if (strategy) {
                  logger.warn(`Multiple hydration strategies are not supported in the same component`)
                } else {
                  strategy = hydrationStrategyMap[prop as keyof typeof hydrationStrategyMap]
                }
              }
            }

            if (strategy) {
              const newName = 'Lazy' + strategy + pascalName
              const chunk = template.slice(node.loc[0].start, node.loc.at(-1)!.end)
              const chunkOffset = node.loc[0].start + offset
              const { 0: startingChunk, index: startingPoint = 0 } = chunk.match(new RegExp(`<${node.name}[^>]*>`)) || {}
              s.overwrite(startingPoint + chunkOffset, startingPoint + chunkOffset + startingChunk!.length, startingChunk!.replace(node.name, newName))

              const { 0: endingChunk, index: endingPoint } = chunk.match(new RegExp(`<\\/${node.name}[^>]*>$`)) || {}
              if (endingChunk && endingPoint) {
                s.overwrite(endingPoint + chunkOffset, endingPoint + chunkOffset + endingChunk.length, endingChunk.replace(node.name, newName))
              }
            }
          })
        } catch {
          // ignore errors if it's not html-like
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
    {
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
                switch (modifier) {
                  case 'Visible':
                  case 'visible-':
                    imports.add(genImport(options.clientDelayedComponentRuntime, [{ name: 'createLazyVisibleComponent' }]))
                    identifier += '_lazy_visible'
                    imports.add(`const ${identifier} = createLazyVisibleComponent(${dynamicImport})`)
                    break
                  case 'Interaction':
                  case 'interaction-':
                    imports.add(genImport(options.clientDelayedComponentRuntime, [{ name: 'createLazyInteractionComponent' }]))
                    identifier += '_lazy_event'
                    imports.add(`const ${identifier} = createLazyInteractionComponent(${dynamicImport})`)
                    break
                  case 'Idle':
                  case 'idle-':
                    imports.add(genImport(options.clientDelayedComponentRuntime, [{ name: 'createLazyIdleComponent' }]))
                    identifier += '_lazy_idle'
                    imports.add(`const ${identifier} = createLazyIdleComponent(${dynamicImport})`)
                    break
                  case 'MediaQuery':
                  case 'media-query-':
                    imports.add(genImport(options.clientDelayedComponentRuntime, [{ name: 'createLazyMediaQueryComponent' }]))
                    identifier += '_lazy_media'
                    imports.add(`const ${identifier} = createLazyMediaQueryComponent(${dynamicImport})`)
                    break
                  case 'If':
                  case 'if-':
                    imports.add(genImport(options.clientDelayedComponentRuntime, [{ name: 'createLazyIfComponent' }]))
                    identifier += '_lazy_if'
                    imports.add(`const ${identifier} = createLazyIfComponent(${dynamicImport})`)
                    break
                  case 'Never':
                  case 'never-':
                    imports.add(genImport('vue', [{ name: 'defineAsyncComponent', as: '__defineAsyncComponent' }]))
                    identifier += '_lazy_never'
                    imports.add(`const ${identifier} = __defineAsyncComponent({loader: ${dynamicImport}, hydrate: () => {}})`)
                    break
                  case 'Time':
                  case 'time-':
                    imports.add(genImport(options.clientDelayedComponentRuntime, [{ name: 'createLazyTimeComponent' }]))
                    identifier += '_lazy_time'
                    imports.add(`const ${identifier} = createLazyTimeComponent(${dynamicImport})`)
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
    },
  ]
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
