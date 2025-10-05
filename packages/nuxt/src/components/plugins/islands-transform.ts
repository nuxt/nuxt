import { readFileSync } from 'node:fs'
import { normalize } from 'node:path'
import { join } from 'pathe'
import MagicString from 'magic-string'
import { hash } from 'ohash'

import type { PluginOption } from 'vite'
import type { ExportDefaultDeclaration } from 'acorn'

import vue from '@vitejs/plugin-vue'
import { defu } from 'defu'
import type { Options } from '@vitejs/plugin-vue'

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
const VSC_PREFIX_RE = /^(\/?@id\/)?virtual:vsc:/
const VIRTUAL_MODULE_ID = 'virtual:components-chunk'
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID

const MAP_VIRTUALMOD_ID = 'virtual:component-map'

export function vueServerComponentsPlugin (options: Partial<VSCOptions> = {}): { client: (options: Options) => PluginOption, server: (options: Options) => PluginOption } {
  const refs: { path: string, id: string }[] = []
  let assetDir: string = ''
  let isProduction = false
  let rootDir = process.cwd()
  const { clientVscDir = '' } = options

  const serverComprefs: string[] = []
  return {
    client: (opts: Options) => [vue(opts), {
      name: 'vite:vue-server-components-client',
      configResolved (config) {
        assetDir = config.build.assetsDir
        isProduction = config.isProduction
        rootDir = config.root
      },
      async buildStart () {
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
    }],

    server: opts => [

      getPatchedClientVue(opts),
      getPatchedServerVue(opts),
      {
        enforce: 'pre',
        name: 'vite:vue-server-components-server',
        resolveId: {
          order: 'pre',
          async handler (id, importer) {
            if (id === VIRTUAL_MODULE_ID) {
              return RESOLVED_VIRTUAL_MODULE_ID
            }
            if (importer && VSC_PREFIX_RE.test(importer)) {
              if (VSC_PREFIX_RE.test(id)) {
                return id
              }
              if (id.endsWith('.vue') && !VSC_PREFIX_RE.test(id)) {
                const resolved = (await this.resolve(id, importer.replace(VSC_PREFIX_RE, '')))
                if (resolved) {
                  return VSC_PREFIX + resolved.id
                }
              }
              return this.resolve(id, importer.replace(VSC_PREFIX_RE, ''), { skipSelf: true })
            }

            if (VSC_PREFIX_RE.test(id)) {
              return id
            }
            console.log('resolveId', id)
          },
        },
        load: {
          order: 'pre',
          handler (id) {
            const [filename, rawQuery] = id.split(`?`, 2)

            if (!rawQuery) {
              if (VSC_PREFIX_RE.test(id)) {
                const file = id.replace(VSC_PREFIX_RE, '')

                return {
                  code: readFileSync(file, 'utf-8'),
                }
              }
              if (filename?.endsWith('.vue')) {
                const fileName = '_nuxt/' + hash(id) + '.mjs'
                this.emitFile({
                  type: 'chunk',
                  fileName,
                  id: VSC_PREFIX + id,
                  preserveSignature: 'strict',
                })
                serverComprefs.push(id)
              }
            }
          },
        },

        generateBundle (_, bundle) {
          console.log(Object.keys(bundle))

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
          handler (code, id) {
            if (VSC_PREFIX_RE.test(id)) {
              const ogId = id.replace(VSC_PREFIX_RE, '')
              const s = new MagicString(code)
              const ast = this.parse(code)
              const exportDefault = ast.body.find((node) => {
                return node.type === 'ExportDefaultDeclaration'
              }) as ExportDefaultDeclaration & { start: number, end: number } | undefined
              const ExportDefaultDeclaration = exportDefault?.declaration
              if (ExportDefaultDeclaration) {
                const { start, end } = ExportDefaultDeclaration
                s.overwrite(start, end, `Object.assign(
                                      { __chunk: "${join('/', isProduction ? normalize(this.getFileName(id)) : '/_nuxt/@fs/' + normalize(ogId)).replaceAll('\\', '/')}" },
                                        ${code.slice(start, end)},
                                  )`)
                return {
                  code: s.toString(),
                  map: s.generateMap({ hires: true }).toString(),
                }
              }
            }
          },
        },
      },
    ],
  }
}

// fix a bug in plugin vue
function getPatchedClientVue (options?: Options) {
  const plugin = vue(defu({
    exclude: [VSC_PREFIX_RE],
  }, options))
  const oldTransform = plugin.transform
  // plugin.transform = async function (code, id, _options) {
  //   // @ts-expect-error ssrUtils is not a public API
  //   return await oldTransform.apply(this, [code, id, _options])
  // }
  const oldLoad = plugin.load
  // plugin.load = {
  //   filter: {
  //     id: {
  //       exclude: [VSC_PREFIX_RE],
  //     },
  //   },

  //   handler (id: string, _options) {
  //     // @ts-expect-error ssrUtils is not a public API
  //     return await oldLoad.apply(this, [id, _options])
  //   },
  // }
  plugin.load.filter ={
    // id: {
    //   exclude: [VSC_PREFIX_RE],
    // },
  }
  // plugin.load = async function (id, _options) {
  //   if (VSC_PREFIX_RE.test(id)) {
  //     return
  //   }
  //   // @ts-expect-error ssrUtils is not a public API
  //   return await oldLoad.apply(this, [id, _options])
  // }
  return plugin
}

function getPatchedServerVue (options?: Options): PluginOption {
  const plugin = vue(defu({
    include: [VSC_PREFIX_RE],
  }, options))
  // need to force non-ssr transform to always render vnode
  const oldTransform = plugin.transform
  plugin.transform = async function (code, id, _options) {
    if (!VSC_PREFIX_RE.test(id)) {
      return
    }
    // @ts-expect-error blabla
    return await oldTransform.apply(this, [code, id, { ssr: false }])
  }
  const oldLoad = plugin.load
  plugin.load = async function (id, _options) {
    if (!VSC_PREFIX_RE.test(id)) {
      return
    }
    // @ts-expect-error blabla
    return await oldLoad.apply(this, [id, { ssr: false }])
  }

  return plugin
}
