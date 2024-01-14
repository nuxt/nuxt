import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import fs from 'node:fs'
import type { Component } from '@nuxt/schema'
import { parseURL } from 'ufo'
import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import { ELEMENT_NODE, parse, walk } from 'ultrahtml'
import { hash } from 'ohash'
import { resolvePath } from '@nuxt/kit'
import { isVue } from '../core/utils'

interface ServerOnlyComponentTransformPluginOptions {
    getComponents: () => Component[]
    /**
     * passed down to `NuxtTeleportSsrClient`
     * should be done only in dev mode as we use build:manifest result in production
     */
    rootDir?: string
    isDev?: boolean
    /**
     * allow using `nuxt-client` attribute on components
     */
    selectiveClient?: boolean
}

interface ComponentChunkOptions {
  getComponents: () => Component[]
  buildDir: string
}

const SCRIPT_RE = /<script[^>]*>/g
const HAS_SLOT_OR_CLIENT_RE = /(<slot[^>]*>)|(nuxt-client)/
const TEMPLATE_RE = /<template>([\s\S]*)<\/template>/
const NUXTCLIENT_ATTR_RE = /\snuxt-client(="[^"]*")?/g
const IMPORT_CODE = '\nimport { vforToArray as __vforToArray } from \'#app/components/utils\'' + '\nimport NuxtTeleportSsrClient from \'#app/components/nuxt-teleport-ssr-client\''

export const islandsTransform = createUnplugin((options: ServerOnlyComponentTransformPluginOptions, meta) => {
  const isVite = meta.framework === 'vite'
  const { isDev, rootDir } = options
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
      if (!HAS_SLOT_OR_CLIENT_RE.test(code)) { return }
      const template = code.match(TEMPLATE_RE)
      if (!template) { return }
      const startingIndex = template.index || 0
      const s = new MagicString(code)

      if (!code.match(SCRIPT_RE)) {
        s.prepend('<script setup>' + IMPORT_CODE + '</script>')
      } else {
        s.replace(SCRIPT_RE, (full) => {
          return full + IMPORT_CODE 
        })
      }


      let hasNuxtClient = false

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
          } else if (options.selectiveClient && ('nuxt-client' in node.attributes || ':nuxt-client' in node.attributes)) {
            hasNuxtClient = true
            const attributeValue = node.attributes[':nuxt-client'] || node.attributes['nuxt-client'] || 'true'
            if (isVite) {
              // handle granular interactivity
              const htmlCode = code.slice(startingIndex + node.loc[0].start, startingIndex + node.loc[1].end)
              const uid = hash(id + node.loc[0].start + node.loc[0].end)

              s.overwrite(startingIndex + node.loc[0].start, startingIndex + node.loc[1].end, `<NuxtTeleportSsrClient to="${node.name}-${uid}" ${rootDir && isDev ? `root-dir="${rootDir}"` : ''} :nuxt-client="${attributeValue}">${htmlCode.replaceAll(NUXTCLIENT_ATTR_RE, '')}</NuxtTeleportSsrClient>`)
            }
          }
        }
      })

      if (!isVite && hasNuxtClient) {
        // eslint-disable-next-line no-console
        console.warn(`nuxt-client attribute and client components within islands is only supported with Vite. file: ${id}`)
      }

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
  const content = Object.entries(bindings).filter(b => b[0] && b[0] !== '_bind').map(([name, value]) => isBinding(name) ? `${name.slice(1)}: ${value}` : `${name}: \`${value}\``).join(',')
  const data = bindings._bind ? `mergeProps(${bindings._bind}, { ${content} })` : `{ ${content} }`
  if (!vfor) {
    return `:nuxt-ssr-slot-data="JSON.stringify([${data}])"`
  } else {
    return `:nuxt-ssr-slot-data="JSON.stringify(__vforToArray(${vfor[1]}).map(${vfor[0]} => (${data})))"`
  }
}

export const componentsChunkPlugin = createUnplugin((options: ComponentChunkOptions) => {
  const { buildDir } = options
  return {
    name: 'componentsChunkPlugin',
    vite: {
      async  config (config) {
        const components = options.getComponents()
        config.build = config.build || {}
        config.build.rollupOptions = config.build.rollupOptions || {}
        config.build.rollupOptions.output = config.build.rollupOptions.output || {}
        config.build.rollupOptions.input = config.build.rollupOptions.input || {}
        // don't use 'strict', this would create another "facade" chunk for the entry file, causing the ssr styles to not detect everything
        config.build.rollupOptions.preserveEntrySignatures = 'allow-extension'
        for (const component of components) {
          if (component.mode === 'client' || component.mode === 'all') {
            (config.build.rollupOptions.input as Record<string, string>)[component.pascalName] = await resolvePath(component.filePath)
          }
        }
      },

      async generateBundle (_opts, bundle) {
        const components = options.getComponents().filter(c => c.mode === 'client' || c.mode === 'all')
        const pathAssociation: Record<string, string> = {}
        for (const [chunkPath, chunkInfo] of Object.entries(bundle)) {
          if (chunkInfo.type !== 'chunk') { continue }

          for (const component of components) {
            if (chunkInfo.facadeModuleId && chunkInfo.exports.length > 0) {
              const { pathname } = parseURL(decodeURIComponent(pathToFileURL(chunkInfo.facadeModuleId).href))
              const isPath = await resolvePath(component.filePath) === pathname
              if (isPath) {
                // avoid importing the component chunk in all pages
                chunkInfo.isEntry = false
                pathAssociation[component.pascalName] = chunkPath
              }
            }
          }
        }

        fs.writeFileSync(join(buildDir, 'components-chunk.mjs'), `export const paths = ${JSON.stringify(pathAssociation, null, 2)}`)
      }
    }
  }
})
