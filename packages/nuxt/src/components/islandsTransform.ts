import { pathToFileURL } from 'node:url'
import type { Component } from '@nuxt/schema'
import { parseURL } from 'ufo'
import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import { ELEMENT_NODE, parse, walk } from 'ultrahtml'

interface ServerOnlyComponentTransformPluginOptions {
    getComponents: () => Component[]
}

const SCRIPT_RE = /<script[^>]*>/g

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
      return islands.some(c => c.filePath === pathname)
    },
    async transform (code, id) {
      if (!code.includes('<slot ')) { return }
      const template = code.match(/<template>([\s\S]*)<\/template>/)
      if (!template) { return }
      const s = new MagicString(code)

      s.replace(SCRIPT_RE, (full) => {
        return full + '\nimport { vforToArray as __vforToArray } from \'#app/components/utils\''
      })

      const ast = parse(template[0])
      await walk(ast, (node) => {
        if (node.type === ELEMENT_NODE && node.name === 'slot') {
          const { attributes, children, loc, isSelfClosingTag } = node
          const slotName = attributes.name ?? 'default'
          let vfor: [string, string] | undefined
          if (attributes['v-for']) {
            vfor = attributes['v-for'].split(' in ').map((v: string) => v.trim()) as [string, string]
            delete attributes['v-for']
          }
          if (attributes.name) { delete attributes.name }
          if (attributes['v-bind']) {
            attributes._bind = attributes['v-bind']
            delete attributes['v-bind']
          }
          const bindings = getBindings(attributes, vfor)

          if (isSelfClosingTag) {
            s.overwrite(loc[0].start, loc[0].end, `<div style="display: contents;" nuxt-ssr-slot-name="${slotName}" ${bindings}/>`)
          } else {
            s.overwrite(loc[0].start, loc[0].end, `<div style="display: contents;" nuxt-ssr-slot-name="${slotName}" ${bindings}>`)
            s.overwrite(loc[1].start, loc[1].end, '</div>')

            if (children.length > 1) {
              // need to wrap instead of applying v-for on each child
              const wrapperTag = `<div ${vfor ? `v-for="${vfor[0]} in ${vfor[1]}"` : ''} style="display: contents;">`
              s.appendRight(loc[0].end, `<div nuxt-slot-fallback-start="${slotName}"/>${wrapperTag}`)
              s.appendLeft(loc[1].start, '</div><div nuxt-slot-fallback-end/>')
            } else if (children.length === 1) {
              if (vfor && children[0].type === ELEMENT_NODE) {
                const { loc, name, attributes, isSelfClosingTag } = children[0]
                const attrs = Object.entries(attributes).map(([attr, val]) => `${attr}="${val}"`).join(' ')
                s.overwrite(loc[0].start, loc[0].end, `<${name} v-for="${vfor[0]} in ${vfor[1]}" ${attrs} ${isSelfClosingTag ? '/' : ''}>`)
              }

              s.appendRight(loc[0].end, `<div nuxt-slot-fallback-start="${slotName}"/>`)
              s.appendLeft(loc[1].start, '<div nuxt-slot-fallback-end/>')
            }
          }
        }
      })

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
    return `:nuxt-ssr-slot-data="JSON.stringify(__vforToArray(${vfor[1]}).map(${vfor[0]} => (${data})))"`
  }
}
