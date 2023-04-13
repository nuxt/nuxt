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
      s.replaceAll(/<slot ([^/|>]*)(\/)?>/g, (_, attrs: string, selfClosing: string) => {
        let slotName = 'default'
        const bindings: Record<string, string> = {}
        let vfor: [string, string] | undefined
        const parsedAttrs = attrs.replaceAll(ATTRS_RE, (matched, name, value) => {
          name = name.trim()
          if (name.startsWith('v-') && name !== 'v-for') {
            return matched
          } else if (name === 'v-for') {
            vfor = value.split('in').map((v: string) => v.trim())
          } else if (name !== 'name') {
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
        const ssrScopeData = getBindings(bindings, vfor)
        return `<div ${parsedAttrs} nuxt-ssr-slot-name="${slotName}" ${ssrScopeData} ${selfClosing}>`
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

function getBindings (bindings: Record<string, string>, vfor?: [string, string]): string {
  if (Object.keys(bindings).length === 0) { return '' }
  const content = Object.entries(bindings).filter(b => b[0] !== '_bind').map(([name, value]) => isBinding(name) ? `${name.slice(1)}: ${value}` : `${name}: \`${value}\``).join(',')
  const data = bindings._bind ? `mergeProps(${bindings._bind}, { ${content} })` : `{ ${content} }`
  if (!vfor) {
    return `:nuxt-ssr-slot-data="JSON.stringify([${data}])"`
  } else {
    return `:nuxt-ssr-slot-data="JSON.stringify(${vfor[1]}.map((${vfor[0]}) => (${data})))"`
  }
}
