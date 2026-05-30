import { createUnplugin } from 'unplugin'
import { generateTransform, rolldownString } from 'rolldown-string'
import { camelCase, kebabCase, pascalCase } from 'scule'

import { tryUseNuxt } from '@nuxt/kit'
import { parse, walk } from 'ultrahtml'
import { ScopeTracker, parseAndWalk } from 'oxc-walker'
import { isVue } from '../../core/utils/index.ts'
import { logger, resolveToAlias } from '../../utils.ts'
import type { Component, ComponentsOptions } from 'nuxt/schema'

interface LoaderOptions {
  getComponents (): Component[]
  transform?: ComponentsOptions['transform']
}

const SCRIPT_RE = /(?<=<script[^>]*>)[\s\S]*?(?=<\/script>)/gi
const TEMPLATE_RE = /<template(?<attrs>[^>]*)>(?<content>[\s\S]*)<\/template>/
const PUG_LANG_RE = /\blang\s*=\s*(?:"pug"|'pug'|pug)(?=\s|$)/
const PUG_LINE_RE = /.*(?:\r?\n|$)/g
const PUG_TAG_RE = /^(\s*)([a-z][\w-]*)(?=[\s(.#]|$)/i
const hydrationStrategyMap = {
  hydrateOnIdle: 'Idle',
  hydrateOnVisible: 'Visible',
  hydrateOnInteraction: 'Interaction',
  hydrateOnMediaQuery: 'MediaQuery',
  hydrateAfter: 'Time',
  hydrateWhen: 'If',
  hydrateNever: 'Never',
}

const hydrationStrategyAttrs = Object.entries(hydrationStrategyMap).flatMap(([prop, strategy]) => [[prop, strategy], [kebabCase(prop), strategy]] as const)
const TEMPLATE_WITH_LAZY_HYDRATION_RE = /<template(?:\s[^>]*)?>[\s\S]*\b(?:hydrate-on-idle|hydrateOnIdle|hydrate-on-visible|hydrateOnVisible|hydrate-on-interaction|hydrateOnInteraction|hydrate-on-media-query|hydrateOnMediaQuery|hydrate-after|hydrateAfter|hydrate-when|hydrateWhen|hydrate-never|hydrateNever)\b[\s\S]*<\/template>/

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
      async handler (code, id, meta?: unknown) {
        if (!TEMPLATE_WITH_LAZY_HYDRATION_RE.test(code)) {
          return
        }

        // change <LazyMyComponent hydrate-on-idle /> to <LazyIdleMyComponent hydrate-on-idle />
        const templateMatch = code.match(TEMPLATE_RE)
        if (!templateMatch?.groups) {
          return
        }
        const { 0: template, index: offset = 0 } = templateMatch
        const { attrs = '', content = '' } = templateMatch.groups

        try {
          const scopeTracker = new ScopeTracker({ preserveExitedScopes: true })
          for (const { 0: script } of code.matchAll(SCRIPT_RE)) {
            if (!script) { continue }
            try {
              parseAndWalk(script, id, { scopeTracker })
            } catch { /* ignore */ }
          }

          const s = rolldownString(code, id, meta)

          const components = new Set(options.getComponents().map(c => c.pascalName))
          if (PUG_LANG_RE.test(attrs)) {
            transformPugTemplate({
              components,
              content,
              contentOffset: offset + template.indexOf('>') + 1,
              id,
              nuxt,
              s,
              scopeTracker,
            })
            return generateTransform(s, id)
          }

          const ast = parse(template)
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
          return generateTransform(s, id)
        } catch {
          // ignore errors if it's not html-like
        }
      },
    },
  }
})

function transformPugTemplate (ctx: {
  components: Set<string>
  content: string
  contentOffset: number
  id: string
  nuxt: ReturnType<typeof tryUseNuxt>
  s: ReturnType<typeof rolldownString>
  scopeTracker: ScopeTracker
}) {
  for (const match of ctx.content.matchAll(PUG_LINE_RE)) {
    const line = match[0]
    if (!line) { continue }

    const tagMatch = PUG_TAG_RE.exec(line)
    if (!tagMatch) { continue }

    const [, indent, name] = tagMatch
    if (ctx.scopeTracker.getDeclaration(name)) {
      continue
    }

    const pascalName = pascalCase(name.replace(/^(?:Lazy|lazy-)/, ''))
    if (!ctx.components.has(pascalName)) {
      continue
    }

    const strategy = getPugHydrationStrategy(line)
    if (strategy && !/^(?:Lazy|lazy-)/.test(name)) {
      if (name !== 'template' && (ctx.nuxt?.options.dev || ctx.nuxt?.options.test)) {
        const relativePath = resolveToAlias(ctx.id, ctx.nuxt)
        logger.warn(`Component \`<${name}>\` (used in \`${relativePath}\`) has lazy-hydration props but is not declared as a lazy component.\n` +
          `Rename it to \`<Lazy${pascalCase(name)} />\` or remove the lazy-hydration props to avoid unexpected behavior.`)
      }
      continue
    }

    if (strategy) {
      const newName = 'Lazy' + strategy + pascalName
      const start = ctx.contentOffset + match.index + indent.length
      ctx.s.overwrite(start, start + name.length, newName)
    }
  }
}

function getPugHydrationStrategy (line: string) {
  let strategy: string | undefined
  for (const [attr, value] of hydrationStrategyAttrs) {
    const pattern = new RegExp(String.raw`(?:^|[\s(:,])(?::|v-bind:)?${attr}(?=$|[\s=),])`)
    if (!pattern.test(line)) { continue }

    if (strategy) {
      logger.warn(`Multiple hydration strategies are not supported in the same component`)
    } else {
      strategy = value
    }
  }
  return strategy
}
