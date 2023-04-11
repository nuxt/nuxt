import { pathToFileURL } from 'node:url'
import type { Component } from '@nuxt/schema'
import { parseURL } from 'ufo'
import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'

interface ServerOnlyComponentTransformPluginOptions {
    getComponents: () => Component[]
}

const ATTRS_RE = /([^=]*)="([^"]*)"/g

export const islandsTransform = createUnplugin((options: ServerOnlyComponentTransformPluginOptions) => {
  return {
    name: 'server-only-component-transform',
    enforce: 'pre',
    transformInclude (id) {
      const components = options.getComponents()
      const islands = components.filter(component =>
        component.island || (component.mode === 'server' && !components.some(c => c.pascalName === component.pascalName && c.mode === 'client'))
      )
      const { pathname } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      return islands.some(c => c.filePath === pathname) && !id.includes('NuxtIsland')
    },
    transform (code, id) {
      if (!code.includes('<slot ')) { return }

      const s = new MagicString(code)
      s.replaceAll(/<slot ([^>]*)\/?>/g, (_, attrs: string) => {
        let slotName = 'default'
        const bindings: Record<string, string> = {}
        const parsedAttrs = attrs.replaceAll(ATTRS_RE, (matched, name, value) => {
          name = name.trim()
          if (name.startsWith('v-')) {
            return matched
          }
          if (name !== 'name') {
            if (name === 'v-bind') {
              bindings._bind = value
            } else {
              bindings[name] = value
            }
          } else {
            slotName = value
          }
          return ''
        })
        const ssrScopeData = getBindings(bindings)

        return `<div ssr-slot-name="${slotName}" ${ssrScopeData} ${parsedAttrs}>`
      })
      s.replaceAll('</slot>', '</div>')

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: s.generateMap({ source: id, includeContent: true })

        }
      }
    }
  }
})

function isBinding (attr: string): boolean {
  return attr.startsWith(':')
}

function getBindings (bindings: Record<string, string>): string {
  if (Object.keys(bindings).length === 0) { return '' }

  const content = Object.entries(bindings).map(([name, value]) => isBinding(name) ? `${name.slice(1)}: ${value}` : `${name}: \`${value}\``).join(',')
  return `:ssr-slot-data="JSON.stringify({ ${content} })"`
}
