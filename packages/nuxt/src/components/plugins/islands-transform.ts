import { pathToFileURL } from 'node:url'
import fs from 'node:fs'
import { join } from 'pathe'
import type { Component } from '@nuxt/schema'
import { parseURL } from 'ufo'
import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import { ELEMENT_NODE, parse, walk } from 'ultrahtml'
import { resolvePath } from '@nuxt/kit'
import defu from 'defu'
import { isVue } from '../../core/utils'

interface ServerOnlyComponentTransformPluginOptions {
  getComponents: () => Component[]
  /**
   * allow using `nuxt-client` attribute on components
   */
  selectiveClient?: boolean | 'deep'
}

interface ComponentChunkOptions {
  getComponents: () => Component[]
  buildDir: string
}

const SCRIPT_RE = /<script[^>]*>/gi
const HAS_SLOT_OR_CLIENT_RE = /<slot[^>]*>|nuxt-client/
const TEMPLATE_RE = /<template>([\s\S]*)<\/template>/
const NUXTCLIENT_ATTR_RE = /\s:?nuxt-client(="[^"]*")?/g
const IMPORT_CODE = '\nimport { mergeProps as __mergeProps } from \'vue\'' + '\nimport { vforToArray as __vforToArray } from \'#app/components/utils\'' + '\nimport NuxtTeleportIslandComponent from \'#app/components/nuxt-teleport-island-component\'' + '\nimport NuxtTeleportSsrSlot from \'#app/components/nuxt-teleport-island-slot\''
const EXTRACTED_ATTRS_RE = /v-(?:if|else-if|else)(="[^"]*")?/g
const KEY_RE = /:?key="[^"]"/g

function wrapWithVForDiv (code: string, vfor: string): string {
  return `<div v-for="${vfor}" style="display: contents;">${code}</div>`
}

export const IslandsTransformPlugin = (options: ServerOnlyComponentTransformPluginOptions) => createUnplugin((_options, meta) => {
  const isVite = meta.framework === 'vite'
  return {
    name: 'nuxt:server-only-component-transform',
    enforce: 'pre',
    transformInclude (id) {
      if (!isVue(id)) { return false }
      if (isVite && options.selectiveClient === 'deep') { return true }
      const components = options.getComponents()

      const islands = components.filter(component =>
        component.island || (component.mode === 'server' && !components.some(c => c.pascalName === component.pascalName && c.mode === 'client')),
      )
      const { pathname } = parseURL(decodeURIComponent(pathToFileURL(id).href))
      return islands.some(c => c.filePath === pathname)
    },
    transform: {
      filter: {
        code: {
          include: [HAS_SLOT_OR_CLIENT_RE],
        },
      },
      async handler (code, id) {
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
          if (node.type !== ELEMENT_NODE) {
            return
          }
          if (node.name === 'slot') {
            const { attributes, children, loc } = node

            const slotName = attributes.name ?? 'default'

            if (attributes.name) { delete attributes.name }
            if (attributes['v-bind']) {
              attributes._bind = extractAttributes(attributes, ['v-bind'])['v-bind']!
            }
            const teleportAttributes = extractAttributes(attributes, ['v-if', 'v-else-if', 'v-else'])
            const bindings = getPropsToString(attributes)
            // add the wrapper
            s.appendLeft(startingIndex + loc[0].start, `<NuxtTeleportSsrSlot${attributeToString(teleportAttributes)} name="${slotName}" :props="${bindings}">`)

            if (children.length) {
              // pass slot fallback to NuxtTeleportSsrSlot fallback
              const attrString = attributeToString(attributes)
              const slice = code.slice(startingIndex + loc[0].end, startingIndex + loc[1].start).replaceAll(KEY_RE, '')
              s.overwrite(startingIndex + loc[0].start, startingIndex + loc[1].end, `<slot${attrString.replaceAll(EXTRACTED_ATTRS_RE, '')}/><template #fallback>${attributes['v-for'] ? wrapWithVForDiv(slice, attributes['v-for']) : slice}</template>`)
            } else {
              s.overwrite(startingIndex + loc[0].start, startingIndex + loc[0].end, code.slice(startingIndex + loc[0].start, startingIndex + loc[0].end).replaceAll(EXTRACTED_ATTRS_RE, ''))
            }

            s.appendRight(startingIndex + loc[1].end, '</NuxtTeleportSsrSlot>')
            return
          }

          if (!('nuxt-client' in node.attributes) && !(':nuxt-client' in node.attributes)) {
            return
          }

          hasNuxtClient = true

          if (!isVite || !options.selectiveClient) {
            return
          }

          const { loc, attributes } = node
          const attributeValue = attributes[':nuxt-client'] || attributes['nuxt-client'] || 'true'
          const wrapperAttributes = extractAttributes(attributes, ['v-if', 'v-else-if', 'v-else'])

          let startTag = code.slice(startingIndex + loc[0].start, startingIndex + loc[0].end).replace(NUXTCLIENT_ATTR_RE, '')
          if (wrapperAttributes) {
            startTag = startTag.replaceAll(EXTRACTED_ATTRS_RE, '')
          }

          s.appendLeft(startingIndex + loc[0].start, `<NuxtTeleportIslandComponent${attributeToString(wrapperAttributes)} :nuxt-client="${attributeValue}">`)
          s.overwrite(startingIndex + loc[0].start, startingIndex + loc[0].end, startTag)
          s.appendRight(startingIndex + loc[1].end, '</NuxtTeleportIslandComponent>')
        })

        if (hasNuxtClient) {
          if (!options.selectiveClient) {
            console.warn(`The \`nuxt-client\` attribute and client components within islands are only supported when \`experimental.componentIslands.selectiveClient\` is enabled. file: ${id}`)
          } else if (!isVite) {
            console.warn(`The \`nuxt-client\` attribute and client components within islands are only supported with Vite. file: ${id}`)
          }
        }

        if (s.hasChanged()) {
          return {
            code: s.toString(),
            map: s.generateMap({ source: id, includeContent: true }),
          }
        }
      },
    },
  }
})

/**
 * extract attributes from a node
 */
function extractAttributes (attributes: Record<string, string>, names: string[]) {
  const extracted: Record<string, string> = {}
  for (const name of names) {
    if (name in attributes) {
      extracted[name] = attributes[name]!
      delete attributes[name]
    }
  }
  return extracted
}

function attributeToString (attributes: Record<string, string>) {
  return Object.entries(attributes).map(([name, value]) => value ? ` ${name}="${value}"` : ` ${name}`).join('')
}

function isBinding (attr: string): boolean {
  return attr.startsWith(':')
}

function getPropsToString (bindings: Record<string, string>): string {
  const vfor = bindings['v-for']?.split(' in ').map((v: string) => v.trim()) as [string, string] | undefined
  if (Object.keys(bindings).length === 0) { return 'undefined' }
  const content = Object.entries(bindings).filter(b => b[0] && (b[0] !== '_bind' && b[0] !== 'v-for')).map(([name, value]) => isBinding(name) ? `[\`${name.slice(1)}\`]: ${value}` : `[\`${name}\`]: \`${value}\``).join(',')
  const data = bindings._bind ? `__mergeProps(${bindings._bind}, { ${content} })` : `{ ${content} }`
  if (!vfor) {
    return `[${data}]`
  } else {
    return `__vforToArray(${vfor[1]}).map(${vfor[0]} => (${data}))`
  }
}

export const ComponentsChunkPlugin = createUnplugin((options: ComponentChunkOptions) => {
  const { buildDir } = options
  return {
    name: 'nuxt:components-chunk',
    vite: {
      async config (config) {
        const components = options.getComponents()

        config.build = defu(config.build, {
          rollupOptions: {
            input: {},
            output: {},
          },
        })

        const rollupOptions = config.build.rollupOptions!

        if (typeof rollupOptions.input === 'string') {
          rollupOptions.input = { entry: rollupOptions.input }
        } else if (typeof rollupOptions.input === 'object' && Array.isArray(rollupOptions.input)) {
          rollupOptions.input = rollupOptions.input.reduce<{ [key: string]: string }>((acc, input) => { acc[input] = input; return acc }, {})
        }

        // Option does not exist (yet) in `rolldown` - https://github.com/rolldown/rolldown/issues/3500
        const isRolldownCompatEnabled = await import('vite').then(r => 'rolldownVersion' in r)
        if (!isRolldownCompatEnabled) {
          // don't use 'strict', this would create another "facade" chunk for the entry file, causing the ssr styles to not detect everything
          rollupOptions.preserveEntrySignatures = 'allow-extension'
        }
        for (const component of components) {
          if (component.mode === 'client' || component.mode === 'all') {
            rollupOptions.input![component.pascalName] = await resolvePath(component.filePath)
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
      },
    },
  }
})
