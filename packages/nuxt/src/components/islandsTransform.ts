import { pathToFileURL } from 'node:url'
import type { Component } from '@nuxt/schema'
import { parseURL } from 'ufo'
import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import { ELEMENT_NODE, parse, walk } from 'ultrahtml'
import { hash } from 'ohash'
import { isVue } from '../core/utils'

interface ServerOnlyComponentTransformPluginOptions {
    getComponents: () => Component[]
    /**
     * passed down to `TeleportIfClient`
     * should be done only in dev mode as we use build:manifest result in production
     */
    rootDir?: string
}

const SCRIPT_RE = /<script[^>]*>/g
const HAS_SLOT_RE = /<slot[ /]/
const TEMPLATE_RE = /<template>([\s\S]*)<\/template>/

export const islandsTransform = createUnplugin((options: ServerOnlyComponentTransformPluginOptions) => {
  return {
    name: 'server-only-component-transform',
    enforce: 'pre',
    transformInclude (id) {
      if (!isVue(id)) { return false }

      const components = options.getComponents()
      const islands = components.filter(component =>
        component.island || (component.mode === 'server' && !components.some(c => c.pascalName === component.pascalName && c.mode === 'client'))
      )
      const { pathname } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      return islands.some(c => c.filePath === pathname)
    },
    async transform (code, id) {
      if (!HAS_SLOT_RE.test(code)) { return }
      const template = code.match(TEMPLATE_RE)
      if (!template) { return }
      const startingIndex = template.index || 0
      const s = new MagicString(code)

      s.replace(SCRIPT_RE, (full) => {
        return full + '\nimport { vforToArray as __vforToArray } from \'#app/components/utils\'' + '\nimport TeleportIfClient from \'#app/components/TeleportIfClient\''
      })

      const ast = parse(template[0])
      await walk(ast, (node) => {
        if (node.type === ELEMENT_NODE) {
          if (node.name === 'slot') {
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
              s.overwrite(startingIndex + loc[0].start, startingIndex + loc[0].end, `<div style="display: contents;" nuxt-ssr-slot-name="${slotName}" ${bindings}/>`)
            } else {
              s.overwrite(startingIndex + loc[0].start, startingIndex + loc[0].end, `<div style="display: contents;" nuxt-ssr-slot-name="${slotName}" ${bindings}>`)
              s.overwrite(startingIndex + loc[1].start, startingIndex + loc[1].end, '</div>')

              if (children.length > 1) {
                // need to wrap instead of applying v-for on each child
                const wrapperTag = `<div ${vfor ? `v-for="${vfor[0]} in ${vfor[1]}"` : ''} style="display: contents;">`
                s.appendRight(startingIndex + loc[0].end, `<div nuxt-slot-fallback-start="${slotName}"/>${wrapperTag}`)
                s.appendLeft(startingIndex + loc[1].start, '</div><div nuxt-slot-fallback-end/>')
              } else if (children.length === 1) {
                if (vfor && children[0].type === ELEMENT_NODE) {
                  const { loc, name, attributes, isSelfClosingTag } = children[0]
                  const attrs = Object.entries(attributes).map(([attr, val]) => `${attr}="${val}"`).join(' ')
                  s.overwrite(startingIndex + loc[0].start, startingIndex + loc[0].end, `<${name} v-for="${vfor[0]} in ${vfor[1]}" ${attrs} ${isSelfClosingTag ? '/' : ''}>`)
                }

                s.appendRight(startingIndex + loc[0].end, `<div nuxt-slot-fallback-start="${slotName}"/>`)
                s.appendLeft(startingIndex + loc[1].start, '<div nuxt-slot-fallback-end/>')
              }
            }
          } else if ('nuxt-client' in node.attributes) {
            // handle granular interactivity
            const htmlCode = code.slice(startingIndex + node.loc[0].start, startingIndex + node.loc[1].end)
            const uid = hash(id + node.loc[0].start + node.loc[0].end)

            s.overwrite(node.loc[0].start, node.loc[1].end, `<TeleportIfClient to="${node.name}-${uid}" ${options.rootDir ? `root-dir="${options.rootDir}"` : ''} :nuxt-client="${node.attributes['nuxt-client'] || 'true'}">${htmlCode}</TeleportIfClient>`)
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
