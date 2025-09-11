import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import { camelCase, pascalCase } from 'scule'

import { tryUseNuxt } from '@nuxt/kit'
import { parse, walk } from 'ultrahtml'
import { ScopeTracker, parseAndWalk } from 'oxc-walker'
import { isVue } from '../../core/utils'
import { logger, resolveToAlias } from '../../utils'
import type { Component, ComponentsOptions } from 'nuxt/schema'

interface LoaderOptions {
  getComponents (): Component[]
  sourcemap?: boolean
  transform?: ComponentsOptions['transform']
}

const SCRIPT_RE = /(?<=<script[^>]*>)[\s\S]*?(?=<\/script>)/gi
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

const LAZY_HYDRATION_PROPS_RE = /\b(?:hydrate-on-idle|hydrateOnIdle|hydrate-on-visible|hydrateOnVisible|hydrate-on-interaction|hydrateOnInteraction|hydrate-on-media-query|hydrateOnMediaQuery|hydrate-after|hydrateAfter|hydrate-when|hydrateWhen|hydrate-never|hydrateNever)\b/

export const LazyHydrationTransformPlugin = (options: LoaderOptions) => createUnplugin(() => {
  const exclude = options.transform?.exclude || []
  const include = options.transform?.include || []
  const nuxt = tryUseNuxt()

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
    transform: {
      filter: {
        code: { include: TEMPLATE_RE },
      },

      async handler (code, id) {
        const scopeTracker = new ScopeTracker({ preserveExitedScopes: true })

        for (const { 0: script } of code.matchAll(SCRIPT_RE)) {
          if (!script) { continue }
          try {
            parseAndWalk(script, id, {
              scopeTracker,
            })
          } catch { /* ignore */ }
        }

        // change <LazyMyComponent hydrate-on-idle /> to <LazyIdleMyComponent hydrate-on-idle />
        const { 0: template, index: offset = 0 } = code.match(TEMPLATE_RE) || {}
        if (!template || !LAZY_HYDRATION_PROPS_RE.test(template)) {
          return
        }
        const s = new MagicString(code)
        try {
          const ast = parse(template)
          const components = new Set(options.getComponents().map(c => c.pascalName))
          await walk(ast, (node) => {
            if (node.type !== 1 /* ELEMENT_NODE */) {
              return
            }

            if (scopeTracker.getDeclaration(node.name)) {
              return
            }

            const pascalName = pascalCase(node.name.replace(/^(?:Lazy|lazy-)/, ''))
            if (!components.has(pascalName)) {
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

            if (strategy && !/^(?:Lazy|lazy-)/.test(node.name)) {
              if (node.name !== 'template' && (nuxt?.options.dev || nuxt?.options.test)) {
                const relativePath = resolveToAlias(id, nuxt)
                logger.warn(`Component \`<${node.name}>\` (used in \`${relativePath}\`) has lazy-hydration props but is not declared as a lazy component.\n` +
                  `Rename it to \`<Lazy${pascalCase(node.name)} />\` or remove the lazy-hydration props to avoid unexpected behavior.`)
              }
              return
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
  }
})
