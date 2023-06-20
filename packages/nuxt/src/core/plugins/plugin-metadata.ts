import type { CallExpression, Property, SpreadElement } from 'estree'
import type { Node } from 'estree-walker'
import { walk } from 'estree-walker'
import { parse } from 'typescript-estree'
import { defu } from 'defu'
import { findExports } from 'mlly'
import type { Nuxt } from '@nuxt/schema'
import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import { normalize } from 'pathe'

// eslint-disable-next-line import/no-restricted-paths
import type { ObjectPlugin, PluginMeta } from '#app'

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
  'nuxt-post-all': 30
}

export const orderMap: Record<NonNullable<ObjectPlugin['enforce']>, number> = {
  pre: internalOrderMap['user-pre'],
  default: internalOrderMap['user-default'],
  post: internalOrderMap['user-post']
}

const metaCache: Record<string, Omit<PluginMeta, 'enforce'>> = {}
export function extractMetadata (code: string) {
  let meta: PluginMeta = {}
  if (metaCache[code]) {
    return metaCache[code]
  }
  walk(parse(code) as Node, {
    enter (_node) {
      if (_node.type !== 'CallExpression' || (_node as CallExpression).callee.type !== 'Identifier') { return }
      const node = _node as CallExpression & { start: number, end: number }
      const name = 'name' in node.callee && node.callee.name
      if (name !== 'defineNuxtPlugin' && name !== 'definePayloadPlugin') { return }

      if (name === 'definePayloadPlugin') {
        meta.order = internalOrderMap['user-revivers']
      }

      const metaArg = node.arguments[1]
      if (metaArg) {
        if (metaArg.type !== 'ObjectExpression') {
          throw new Error('Invalid plugin metadata')
        }
        meta = extractMetaFromObject(metaArg.properties)
      }

      const plugin = node.arguments[0]
      if (plugin.type === 'ObjectExpression') {
        meta = defu(extractMetaFromObject(plugin.properties), meta)
      }

      meta.order = meta.order || orderMap[meta.enforce || 'default'] || orderMap.default
      delete meta.enforce
    }
  })
  metaCache[code] = meta
  return meta as Omit<PluginMeta, 'enforce'>
}

type PluginMetaKey = keyof PluginMeta
const keys: Record<PluginMetaKey, string> = {
  name: 'name',
  order: 'order',
  enforce: 'enforce'
}
function isMetadataKey (key: string): key is PluginMetaKey {
  return key in keys
}

function extractMetaFromObject (properties: Array<Property | SpreadElement>) {
  const meta: PluginMeta = {}
  for (const property of properties) {
    if (property.type === 'SpreadElement' || !('name' in property.key)) {
      throw new Error('Invalid plugin metadata')
    }
    const propertyKey = property.key.name
    if (!isMetadataKey(propertyKey)) { continue }
    if (property.value.type === 'Literal') {
      meta[propertyKey] = property.value.value as any
    }
    if (property.value.type === 'UnaryExpression' && property.value.argument.type === 'Literal') {
      meta[propertyKey] = JSON.parse(property.value.operator + property.value.argument.raw!)
    }
  }
  return meta
}

export const RemovePluginMetadataPlugin = (nuxt: Nuxt) => createUnplugin(() => {
  return {
    name: 'nuxt:remove-plugin-metadata',
    enforce: 'pre',
    transform (code, id) {
      id = normalize(id)
      const plugin = nuxt.apps.default.plugins.find(p => p.src === id)
      if (!plugin) { return }

      const s = new MagicString(code)
      const exports = findExports(code)
      const defaultExport = exports.find(e => e.type === 'default' || e.name === 'default')
      if (!defaultExport) {
        console.error(`[warn] [nuxt] Plugin \`${plugin.src}\` has no default export and will be ignored at build time. Add \`export default defineNuxtPlugin(() => {})\` to your plugin.`)
        s.overwrite(0, code.length, 'export default () => {}')
        return {
          code: s.toString(),
          map: nuxt.options.sourcemap.client || nuxt.options.sourcemap.server ? s.generateMap({ hires: true }) : null
        }
      }

      let wrapped = false

      try {
        walk(parse(code) as Node, {
          enter (_node) {
            if (_node.type === 'ExportDefaultDeclaration' && (_node.declaration.type === 'FunctionDeclaration' || _node.declaration.type === 'ArrowFunctionExpression')) {
              if ('params' in _node.declaration && _node.declaration.params.length > 1) {
                console.warn(`[warn] [nuxt] Plugin \`${plugin.src}\` is in legacy Nuxt 2 format (context, inject) which is likely to be broken and will be ignored.`)
                s.overwrite(0, code.length, 'export default () => {}')
                wrapped = true // silence a duplicate error
                return
              }
            }
            if (_node.type !== 'CallExpression' || (_node as CallExpression).callee.type !== 'Identifier') { return }
            const node = _node as CallExpression & { start: number, end: number }
            const name = 'name' in node.callee && node.callee.name
            if (name !== 'defineNuxtPlugin' && name !== 'definePayloadPlugin') { return }
            wrapped = true

            if (node.arguments[0].type !== 'ObjectExpression') {
              // TODO: Warn if legacy plugin format is detected
              if ('params' in node.arguments[0] && node.arguments[0].params.length > 1) {
                console.warn(`[warn] [nuxt] Plugin \`${plugin.src}\` is in legacy Nuxt 2 format (context, inject) which is likely to be broken and will be ignored.`)
                s.overwrite(0, code.length, 'export default () => {}')
                return
              }
            }

            // Remove metadata that already has been extracted
            if (!('order' in plugin) && !('name' in plugin)) { return }
            for (const [argIndex, arg] of node.arguments.entries()) {
              if (arg.type !== 'ObjectExpression') { continue }
              for (const [propertyIndex, property] of arg.properties.entries()) {
                if (property.type === 'SpreadElement' || !('name' in property.key)) { continue }
                const propertyKey = property.key.name
                if (propertyKey === 'order' || propertyKey === 'enforce' || propertyKey === 'name') {
                  const nextIndex = arg.properties[propertyIndex + 1]?.range?.[0] || node.arguments[argIndex + 1]?.range?.[0] || (arg.range![1] - 1)
                  s.remove(property.range![0], nextIndex)
                }
              }
            }
          }
        })
      } catch (e) {
        console.error(e)
        return
      }

      if (!wrapped) {
        console.warn(`[warn] [nuxt] Plugin \`${plugin.src}\` is not wrapped in \`defineNuxtPlugin\`. It is advised to wrap your plugins as in the future this may enable enhancements.`)
      }

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: nuxt.options.sourcemap.client || nuxt.options.sourcemap.server ? s.generateMap({ hires: true }) : null
        }
      }
    }
  }
})
