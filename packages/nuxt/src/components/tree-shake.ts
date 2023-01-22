import { pathToFileURL } from 'node:url'
import { parseURL } from 'ufo'
import MagicString from 'magic-string'
import type { Node } from 'ultrahtml'
import { parse, walk, ELEMENT_NODE } from 'ultrahtml'
import { createUnplugin } from 'unplugin'
import type { Component } from '@nuxt/schema'

interface TreeShakeTemplatePluginOptions {
  sourcemap?: boolean
  getComponents (): Component[]
}

const PLACEHOLDER_RE = /^(v-slot|#)(fallback|placeholder)/

export const TreeShakeTemplatePlugin = createUnplugin((options: TreeShakeTemplatePluginOptions) => {
  const regexpMap = new WeakMap<Component[], [RegExp, string[]]>()
  return {
    name: 'nuxt:tree-shake-template',
    enforce: 'pre',
    transformInclude (id) {
      const { pathname } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      return pathname.endsWith('.vue')
    },
    async transform (code, id) {
      const template = code.match(/<template>([\s\S]*)<\/template>/)
      if (!template) { return }

      const components = options.getComponents()

      if (!regexpMap.has(components)) {
        const clientOnlyComponents = components
          .filter(c => c.mode === 'client' && !components.some(other => other.mode !== 'client' && other.pascalName === c.pascalName))
          .flatMap(c => [c.pascalName, c.kebabName])
          .concat(['ClientOnly', 'client-only'])
        const tags = clientOnlyComponents
          .map(component => `<(${component})[^>]*>[\\s\\S]*?<\\/(${component})>`)

        regexpMap.set(components, [new RegExp(`(${tags.join('|')})`, 'g'), clientOnlyComponents])
      }

      const [COMPONENTS_RE, clientOnlyComponents] = regexpMap.get(components)!
      if (!COMPONENTS_RE.test(code)) { return }

      const s = new MagicString(code)

      const ast = parse(template[0])
      await walk(ast, (node) => {
        if (node.type !== ELEMENT_NODE || !clientOnlyComponents.includes(node.name) || !node.children?.length) {
          return
        }

        const fallback = node.children.find(
          (n: Node) => n.name === 'template' &&
            Object.entries(n.attributes as Record<string, string>)?.flat().some(attr => PLACEHOLDER_RE.test(attr))
        )

        try {
          // Replace node content
          const text = fallback ? code.slice(template.index! + fallback.loc[0].start, template.index! + fallback.loc[fallback.loc.length - 1].end) : ''
          s.overwrite(template.index! + node.loc[0].end, template.index! + node.loc[node.loc.length - 1].start, text)
        } catch (err) {
          // This may fail if we have a nested client-only component and are trying
          // to replace some text that has already been replaced
        }
      })

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: options.sourcemap
            ? s.generateMap({ source: id, includeContent: true })
            : undefined
        }
      }
    }
  }
})
