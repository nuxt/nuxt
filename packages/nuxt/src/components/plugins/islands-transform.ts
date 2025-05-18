import { pathToFileURL } from 'node:url'
import { writeFileSync } from 'node:fs'
import { join } from 'pathe'
import type { Component } from '@nuxt/schema'
import { parseURL } from 'ufo'
import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import { ELEMENT_NODE, parse, walk } from 'ultrahtml'
import { useNuxt } from '@nuxt/kit'
import { hash } from 'ohash'
import { isVue } from '../../core/utils'

interface ServerOnlyComponentTransformPluginOptions {
  getComponents: () => Component[]
  /**
   * allow using `nuxt-client` attribute on components
   */
  selectiveClient?: boolean | 'deep'
}

const SCRIPT_RE = /<script[^>]*>/gi
const HAS_SLOT_OR_CLIENT_RE = /<slot[^>]*>|nuxt-client/
const TEMPLATE_RE = /<template>([\s\S]*)<\/template>/
const NUXTCLIENT_ATTR_RE = /\s:?nuxt-client(="[^"]*")?/g
const IMPORT_CODE = '\nimport { mergeProps as __mergeProps } from \'vue\'' + '\nimport { vforToArray as __vforToArray } from \'#app/components/utils\'' + '\nimport NuxtTeleportIslandComponent from \'#app/components/nuxt-teleport-island-component\'' + '\nimport NuxtTeleportSsrSlot from \'#app/components/nuxt-teleport-island-slot\''
const EXTRACTED_ATTRS_RE = /v-(?:if|else-if|else)(="[^"]*")?/g
const KEY_RE = /:?key="[^"]"/g

function wrapWithVForDiv(code: string, vfor: string): string {
  return `<div v-for="${vfor}" style="display: contents;">${code}</div>`
}
 

/**
 * extract attributes from a node
 */
function extractAttributes(attributes: Record<string, string>, names: string[]) {
  const extracted: Record<string, string> = {}
  for (const name of names) {
    if (name in attributes) {
      extracted[name] = attributes[name]!
      delete attributes[name]
    }
  }
  return extracted
}

function attributeToString(attributes: Record<string, string>) {
  return Object.entries(attributes).map(([name, value]) => value ? ` ${name}="${value}"` : ` ${name}`).join('')
}

function isBinding(attr: string): boolean {
  return attr.startsWith(':')
}

function getPropsToString(bindings: Record<string, string>): string {
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

type ChunkPluginOptions = {
  getComponents: () => Component[]
}

 



import type { PluginOption } from "vite"
import type { ExportDefaultDeclaration } from "acorn"
import { normalize, relative } from "node:path"
import { readFileSync } from "node:fs"
import vue from "@vitejs/plugin-vue"
import { defu } from "defu"
import type { Options } from "@vitejs/plugin-vue"

export type VSCOptions = {
  include: string[]
  rootDir?: string
  vueClient?: Options
  vueServerOptions?: Options
  /**
   * @default your dist dir
   */
  serverVscDir?: string
  /**
   * @default your asset dir
   */
  clientVscDir?: string
}

const VSC_PREFIX = 'virtual:vsc:'
const VSC_PREFIX_RE = /^virtual:vsc:/
const VIRTUAL_MODULE_ID = 'virtual:components-chunk'
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID

const MAP_VIRTUALMOD_ID = 'virtual:component-map'
const RESOLVED_MAP_VIRTUALMOD_ID = '\0' + MAP_VIRTUALMOD_ID


export function vueServerComponentsPlugin(options: Partial<VSCOptions> = {}): { client: (options: Options) => PluginOption, server: (options: Options) =>  PluginOption } {
  const refs: { path: string, id: string }[] = []
  let assetDir: string = ''
  let isProduction = false
  let rootDir = process.cwd()
  const { serverVscDir = '', clientVscDir = '' } = options

  const serverComprefs = new Map<string, string>()
  return {
    client: (opts: Options) => [vue(opts),{
        name: 'vite:vue-server-components-client',
        configResolved(config) {
          assetDir = config.build.assetsDir
          isProduction = config.isProduction
          rootDir = config.root
        },
        async buildStart() {
          if (options?.include) {
            for (const path of options.include) {
              const resolved = await this.resolve(path)
              if (resolved) {
                if (isProduction) {

                  const id = this.emitFile({
                    type: 'chunk',
                    fileName: join(clientVscDir || assetDir, hash(resolved) + '.mjs'),
                    id: resolved.id,
                    preserveSignature: 'strict',
                  })
                  refs.push({ path: resolved.id, id })
                } else {
                  refs.push({ path: resolved.id, id: resolved.id })
                }
              }
            }
          }
        },
        generateBundle(_, bundle) {
          for (const chunk of Object.values(bundle)) {
            if (chunk.type === 'chunk') {
              const list = refs.map(ref => ref.id)
              if (list.includes(chunk.fileName)) {
                chunk.isEntry = false
                console.log(chunk.fileName)
              }
            }
          }
        }
      }],

    server: (opts ) => [
      
      getPatchedClientVue(opts), 
      getPatchedServerVue(opts),
      {
        enforce: 'pre',
        name: 'vite:vue-server-components-server',
        resolveId: {
          order: 'pre',
          async handler(id, importer) {
            if (id === VIRTUAL_MODULE_ID) {
              return RESOLVED_VIRTUAL_MODULE_ID
            }
            if (importer) {
              if (VSC_PREFIX_RE.test(importer)) {
                if (VSC_PREFIX_RE.test(id)) {
                  return id
                }
                if (id.endsWith('.vue')) {
                  const resolved = (await this.resolve(id, importer.replace(VSC_PREFIX_RE, '')))
                  if (resolved) {
                    return VSC_PREFIX + resolved.id
                  }
                }
                return this.resolve(id, importer.replace(VSC_PREFIX_RE, ''), { skipSelf: true })
              }
            }

            if (VSC_PREFIX_RE.test(id)) {
              return id
            }
          }
        },
        load: {
          order: 'pre',
          async handler(id) {
            const [filename, rawQuery] = id.split(`?`, 2);

            if (!rawQuery) {
              if (VSC_PREFIX_RE.test(id)) {
                const file = id.replace(VSC_PREFIX_RE, '')

                return {
                  code: readFileSync(file, 'utf-8'),
                }
              }
              const nuxt = useNuxt()
              const components = nuxt.apps.default?.components || []
              if (filename?.endsWith('.vue') && !(filename.includes('islands') || filename.includes('.server.vue'))) {
                const fileName = '_nuxt/' + hash(id) + '.mjs'
                this.emitFile({
                  type: 'chunk',
                  fileName,
                  id: VSC_PREFIX + id,
                  preserveSignature: 'strict',
                })
                console.log(fileName, 'filename')
                serverComprefs.set(id, fileName)
              }
            }
          }
        },

        generateBundle(_, bundle) {
          for (const chunk of Object.values(bundle)) {
            if (chunk.type === 'chunk') {
              const list = refs.map(ref => ref.id)
              if (list.includes(chunk.fileName)) {
                chunk.isEntry = false
              }
            }
          }
        },

        transform: {
          order: 'post',
          handler(code, id) {
            const ref = refs.find(ref => ref.path === id)
            if (ref) {

              const s = new MagicString(code)
              const ast = this.parse(code)
              const exportDefault = ast.body.find(node => {
                return node.type === 'ExportDefaultDeclaration'
              }) as ExportDefaultDeclaration & { start: number, end: number } | undefined
              const ExportDefaultDeclaration = exportDefault?.declaration
              if (ExportDefaultDeclaration) {
                const { start, end } = ExportDefaultDeclaration
                s.overwrite(start, end, `Object.assign(
                                    { __chunk: "${join('/', isProduction ? normalize(this.getFileName(ref.id)) : relative(rootDir, normalize(ref.id))).replaceAll('\\', '/')}" },
                                    { __vnodeVersion: ${JSON.stringify(serverComprefs.get(id)!)}} ,
                                     ${code.slice(start, end)},
                                )`)
                return {
                  code: s.toString(),
                  map: s.generateMap({ hires: true }).toString(),
                }
              }
            }
          }
        }
      }
    ],
  }
}


// fix a bug in plugin vue
function getPatchedClientVue(options?: Options) {
  const plugin = vue(defu({
    exclude: [VSC_PREFIX_RE],
  },options,))
  console.log(options)
  const oldTransform = plugin.transform;
  plugin.transform = async function (code, id, _options) {
    if (VSC_PREFIX_RE.test(id)) {
      return
    }
    // @ts-expect-error ssrUtils is not a public API
    return await oldTransform.apply(this, [code, id, _options]);
  };
  const oldLoad = plugin.load;
  plugin.load = async function (id, _options) {
    if (VSC_PREFIX_RE.test(id)) {
      return
    }
    // @ts-expect-error ssrUtils is not a public API
    return await oldLoad.apply(this, [id, _options]);
  };
  return plugin;
}

function getPatchedServerVue(options?: Options): PluginOption {
  const plugin = vue(defu( {
    include: [VSC_PREFIX_RE]
  }, options))
  // need to force non-ssr transform to always render vnode
  const oldTransform = plugin.transform;
  plugin.transform = async function (code, id, _options) {
    if (!VSC_PREFIX_RE.test(id)) {
       return
    }
    // @ts-expect-error blabla
    return await oldTransform.apply(this, [code, id, { ssr: false }]);
  };
  const oldLoad = plugin.load;
  plugin.load = async function (id, _options) {
    if (!VSC_PREFIX_RE.test(id)) {
       return
    }
    // @ts-expect-error blabla
    return await oldLoad.apply(this, [id, { ssr: false }]);
  };


  return plugin;
}