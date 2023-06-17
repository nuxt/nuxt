import type { CallExpression, Property, SpreadElement } from 'estree'
import type { Node } from 'estree-walker'
import { walk } from 'estree-walker'
// import { parse } from 'acorn'
import { parse } from 'typescript-estree'
import { defu } from 'defu'

// eslint-disable-next-line import/no-restricted-paths
import type { ObjectPluginInput, PluginMeta } from '#app'

// -50: pre-all (nuxt)
// -40: custom payload revivers (user)
// -30: payload reviving (nuxt)
// -20: pre (user) <-- pre mapped to this
// -10: default (nuxt)
// 0: default (user) <-- default behavior
// +10: post (nuxt)
// +20: post (user) <-- post mapped to this
// +30: post-all (nuxt)

export const orderMap: Record<NonNullable<ObjectPluginInput['enforce']>, number> = {
  pre: -20,
  default: 0,
  post: 20
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
        meta.order = -40
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
  }
  return meta
}
