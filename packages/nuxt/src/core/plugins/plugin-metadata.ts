import type { Literal } from 'estree'
import { defu } from 'defu'
import { findExports } from 'mlly'
import type { Nuxt } from '@nuxt/schema'
import { createUnplugin } from 'unplugin'
import { generateTransform, rolldownString } from 'rolldown-string'
import { normalize } from 'pathe'
import type { NuxtAppLiterals, PluginMeta } from '../../app/types'

import { parseAndWalk } from 'oxc-walker'
import type { ESTree } from 'rolldown/utils'
import { pluginDiagnostics } from '@nuxt/kit'

const internalOrderMap = {
  // -50: pre-all (nuxt)
  'nuxt-pre-all': -50,
  // -40: custom payload revivers (user)
  'user-revivers': -40,
  // -30: payload reviving (nuxt)
  'nuxt-revivers': -30,
  // -20: pre (user) <-- pre mapped to this
  'user-pre': -20,
  // -10: default (nuxt)
  'nuxt-default': -10,
  // 0: default (user) <-- default behavior
  'user-default': 0,
  // +10: post (nuxt)
  'nuxt-post': 10,
  // +20: post (user) <-- post mapped to this
  'user-post': 20,
  // +30: post-all (nuxt)
  'nuxt-post-all': 30,
}

export const orderMap: Record<NonNullable<PluginMeta['enforce']>, number> = {
  pre: internalOrderMap['user-pre'],
  default: internalOrderMap['user-default'],
  post: internalOrderMap['user-post'],
}

export type ExtractedPluginMeta = PluginMeta & { parallel?: boolean, hasHooks?: boolean, hasEnv?: boolean, _metaUnknown?: boolean }

const metaCache: Record<string, ExtractedPluginMeta> = {}
export function extractMetadata (code: string, loader = 'ts' as 'ts' | 'tsx') {
  let meta: ExtractedPluginMeta = {}
  if (metaCache[code]) {
    return metaCache[code]
  }
  parseAndWalk(code, `file.${loader}`, (node) => {
    if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') { return }

    const name = 'name' in node.callee && node.callee.name
    if (name !== 'defineNuxtPlugin' && name !== 'definePayloadPlugin') { return }

    if (name === 'definePayloadPlugin') {
      meta.order = internalOrderMap['user-revivers']
    }

    const metaArg = node.arguments[1]
    if (metaArg) {
      if (metaArg.type !== 'ObjectExpression') {
        throw pluginDiagnostics.NUXT_B2001({ name: name as string, type: metaArg.type })
      }
      meta = extractMetaFromObject(metaArg.properties)
    }

    const plugin = node.arguments[0]
    if (plugin?.type === 'ObjectExpression') {
      meta = defu(extractMetaFromObject(plugin.properties), meta)
    } else if (plugin && !isFunctionPluginExpression(plugin)) {
      // Plugin argument is something we can't statically read (an imported
      // identifier, a factory call, a member access, ...). It may declare
      // hooks / env / dependsOn / parallel that we can't see, so flag the
      // metadata as unknown and let the capability probes fall back to the
      // full runtime resolver.
      meta._metaUnknown = true
    }

    meta.order ||= orderMap[meta.enforce || 'default'] || orderMap.default
    delete meta.enforce
  })
  metaCache[code] = meta
  return meta
}

function isFunctionPluginExpression (node: ESTree.Expression | ESTree.SpreadElement): boolean {
  // Function-syntax plugins (`defineNuxtPlugin(() => {...})` /
  // `defineNuxtPlugin(function (n) {...})`) carry no capability metadata by
  // construction, so emitting empty extracted meta is safe and lets the
  // runtime keep its DCE paths.
  return node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression'
}

type ExtractedMetaKey = keyof PluginMeta | 'parallel'
const keys: Record<ExtractedMetaKey, string> = {
  name: 'name',
  order: 'order',
  enforce: 'enforce',
  dependsOn: 'dependsOn',
  parallel: 'parallel',
}
function isMetadataKey (key: string | ESTree.IdentifierName): key is ExtractedMetaKey {
  return typeof key !== 'string' ? key.name in keys : key in keys
}

function extractMetaFromObject (properties: Array<ESTree.ObjectPropertyKind>) {
  const meta: ExtractedPluginMeta = {}
  for (const property of properties) {
    if (property.type === 'SpreadElement' || !('name' in property.key)) {
      throw pluginDiagnostics.NUXT_B2002()
    }
    const propertyKey = property.key.name
    if (propertyKey === 'hooks') {
      meta.hasHooks = true
      continue
    }
    if (propertyKey === 'env') {
      meta.hasEnv = true
      continue
    }
    if (!isMetadataKey(propertyKey)) { continue }
    if (property.value.type === 'Literal') {
      meta[propertyKey] = property.value.value as any
    }
    if (property.value.type === 'UnaryExpression' && property.value.argument.type === 'Literal') {
      meta[propertyKey] = JSON.parse(property.value.operator + property.value.argument.raw!)
    }
    if (propertyKey === 'dependsOn' && property.value.type === 'ArrayExpression') {
      if (property.value.elements.some(e => !e || e.type !== 'Literal' || typeof e.value !== 'string')) {
        throw pluginDiagnostics.NUXT_B2003()
      }
      meta[propertyKey] = property.value.elements.map(e => (e as Literal)!.value as NuxtAppLiterals['pluginName'])
    }
  }
  return meta
}

export const RemovePluginMetadataPlugin = (nuxt: Nuxt) => createUnplugin(() => {
  return {
    name: 'nuxt:remove-plugin-metadata',
    transform (code, id, meta?: unknown) {
      id = normalize(id)
      const plugin = nuxt.apps.default?.plugins.find(p => p.src === id)
      if (!plugin) { return }

      if (!code.trim()) {
        pluginDiagnostics.NUXT_B2004({ src: plugin.src })

        return {
          code: 'export default () => {}',
          map: null,
        }
      }

      const exports = findExports(code)
      const defaultExport = exports.find(e => e.type === 'default' || e.name === 'default')
      if (!defaultExport) {
        pluginDiagnostics.NUXT_B2005({ src: plugin.src })
        return {
          code: 'export default () => {}',
          map: null,
        }
      }

      const s = rolldownString(code, id, meta)
      let wrapped = false
      const wrapperNames = new Set(['defineNuxtPlugin', 'definePayloadPlugin'])

      try {
        parseAndWalk(code, id, (node) => {
          if (node.type === 'ImportSpecifier' && node.imported.type === 'Identifier' && (node.imported.name === 'defineNuxtPlugin' || node.imported.name === 'definePayloadPlugin')) {
            wrapperNames.add(node.local.name)
          }
          if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') { return }

          const name = 'name' in node.callee && node.callee.name
          if (!name || !wrapperNames.has(name)) { return }
          wrapped = true

          // Remove metadata that already has been extracted
          if (!('order' in plugin) && !('name' in plugin)) { return }
          for (const [argIndex, arg] of node.arguments.entries()) {
            if (arg.type !== 'ObjectExpression') { continue }

            for (const [propertyIndex, property] of arg.properties.entries()) {
              if (property.type === 'SpreadElement' || !('name' in property.key)) { continue }

              const propertyKey = property.key.name
              if (propertyKey === 'order' || propertyKey === 'enforce' || propertyKey === 'name') {
                const nextNode = arg.properties[propertyIndex + 1] || node.arguments[argIndex + 1]
                const nextIndex = nextNode?.start || (arg.end - 1)

                s.remove(property.start, nextIndex)
              }
            }
          }
        })
      } catch (e) {
        pluginDiagnostics.NUXT_B2006({ src: plugin.src, cause: e })
        return
      }

      if (!wrapped) {
        pluginDiagnostics.NUXT_B2007({ src: plugin.src })
      }

      return generateTransform(s, id)
    },
  }
})
