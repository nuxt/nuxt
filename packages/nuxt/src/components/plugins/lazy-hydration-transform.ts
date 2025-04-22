import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import { camelCase, pascalCase } from 'scule'
import type { Component, ComponentsOptions } from 'nuxt/schema'

import { parse, walk } from 'ultrahtml'
import { isVue } from '../../core/utils'
import { logger } from '../../utils'

interface LoaderOptions {
  getComponents (): Component[]
  sourcemap?: boolean
  transform?: ComponentsOptions['transform']
}

const TEMPLATE_RE = /<template>([\s\S]*)<\/template>/
const SINGLE_LINE_COMMENT_RE = /\/\/.*(?:\n|$)/g
const MULTI_LINE_COMMENT_RE = /\/\*[\s\S]*?\*\//g
const EXCLUDE_RE = [
  // imported/exported from other module
  /\b(import|export)\b([\w$*{},\s]+?)\bfrom\s*["']/g,
  // defined as function
  /\bfunction\s*([\w$]+)\s*\(/g,
  // defined as class
  /\bclass\s*([\w$]+)\s*\{/g,
  // defined as local variable
  // eslint-disable-next-line regexp/no-super-linear-backtracking
  /\b(?:const|let|var)\s+?(\[.*?\]|\{.*?\}|.+?)\s*?[=;\n]/gs,
]
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
      const codeWithoutComments = code
        .replace(MULTI_LINE_COMMENT_RE, '')
        .replace(SINGLE_LINE_COMMENT_RE, '\n')

      const variables = new Set<string>()
      if (codeWithoutComments !== code) {
        for (const regex of EXCLUDE_RE) {
          for (const match of codeWithoutComments.matchAll(regex)) {
            if (!match[1]) { continue }
            variables.add(match[1])
          }
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

          if (variables.has(node.name)) {
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
