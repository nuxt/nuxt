import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import { camelCase, pascalCase } from 'scule'
import type { Component, ComponentsOptions } from 'nuxt/schema'

import type { Node } from 'estree'
import { parse, walk } from 'ultrahtml'
import { parse as toAcornAst } from 'acorn'
import { walk as esWalk } from 'estree-walker'
import { isVue } from '../../core/utils'
import { logger } from '../../utils'

interface LoaderOptions {
  getComponents (): Component[]
  sourcemap?: boolean
  transform?: ComponentsOptions['transform']
}

const SCRIPT_RE = /<script\b[^>]*>([\s\S]*?)<\/script>/g
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
const LAZY_HYDRATION_PROPS_RE = /\bhydrate-?on-?idle|hydrate-?on-?visible|hydrate-?on-?interaction|hydrate-?on-?media-?query|hydrate-?after|hydrate-?when|hydrate-?never\b/
export const LazyHydrationTransformPlugin = (options: LoaderOptions) => createUnplugin(() => {
  const exclude = options.transform?.exclude || []
  const include = options.transform?.include || []

  return {
    name: 'nuxt:components-loader-pre',
    enforce: 'pre',
    transformInclude (id) {
      if (exclude.some(pattern => pattern.test(id))) {
        return false
      }
      if (include.some(pattern => pattern.test(id))) {
        return true
      }
      return isVue(id)
    },
    async transform (code) {
      const declarations = new Set<string>()

      for (const { 1: script } of code.matchAll(SCRIPT_RE)) {
        if (!script) { continue }

        try {
          const ast = toAcornAst(script, {
            sourceType: 'module',
            ecmaVersion: 'latest',
            locations: true,
          }) as Node

          esWalk(ast, {
            enter (node) {
              switch (node.type) {
                case 'ImportSpecifier':
                case 'ImportDefaultSpecifier':
                case 'ImportNamespaceSpecifier':
                  declarations.add(node.local.name)
                  return
                case 'FunctionDeclaration':
                case 'ClassDeclaration':
                  if (node.id) {
                    declarations.add(node.id.name)
                  }
                  return
                case 'VariableDeclarator':
                  if (node.id.type === 'Identifier') {
                    declarations.add(node.id.name)
                  } else {
                    esWalk(node.id, {
                      enter (node) {
                        if (node.type === 'ObjectPattern') {
                          node.properties.forEach((i) => {
                            if (i.type === 'Property' && i.value.type === 'Identifier') {
                              declarations.add(i.value.name)
                            } else if (i.type === 'RestElement' && i.argument.type === 'Identifier') {
                              declarations.add(i.argument.name)
                            }
                          })
                        } else if (node.type === 'ArrayPattern') {
                          node.elements.forEach((i) => {
                            if (i?.type === 'Identifier') {
                              declarations.add(i.name)
                            }
                            if (i?.type === 'RestElement' && i.argument.type === 'Identifier') {
                              declarations.add(i.argument.name)
                            }
                          })
                        }
                      },
                    })
                  }
                  return
              }
            },
          })
        } catch {
          // ignore errors
        }
      }

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

          if (declarations.has(node.name)) {
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
  }
})
