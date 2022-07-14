import { pathToFileURL } from 'node:url'
import { parseURL } from 'ufo'
import MagicString from 'magic-string'
import { createUnplugin } from 'unplugin'
import type { Component } from '@nuxt/schema'

interface TreeShakeTemplatePluginOptions {
  sourcemap?: boolean
  getComponents(): Component[]
}

export const TreeShakeTemplatePlugin = createUnplugin((options: TreeShakeTemplatePluginOptions) => {
  const regexpMap = new WeakMap<Component[], RegExp>()
  return {
    name: 'nuxt:tree-shake-template',
    enforce: 'pre',
    transformInclude (id) {
      const { pathname } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      return pathname.endsWith('.vue')
    },
    transform (code, id) {
      const components = options.getComponents()

      if (!regexpMap.has(components)) {
        const clientOnlyComponents = components
          .filter(c => c.mode === 'client' && !components.some(other => other.mode !== 'client' && other.pascalName === c.pascalName))
          .map(c => `${c.pascalName}|${c.kebabName}`)
          .concat('ClientOnly|client-only')
          .map(component => `<(${component})[^>]*>[\\s\\S]*?<\\/(${component})>`)

        regexpMap.set(components, new RegExp(`(${clientOnlyComponents.join('|')})`, 'g'))
      }

      const COMPONENTS_RE = regexpMap.get(components)
      const s = new MagicString(code)

      // Do not render client-only slots on SSR, but preserve attributes
      s.replace(COMPONENTS_RE, r => r.replace(/<([^ >]*)[ >][\s\S]*$/, '<$1 />'))

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: options.sourcemap && s.generateMap({ source: id, includeContent: true })
        }
      }
    }
  }
})
