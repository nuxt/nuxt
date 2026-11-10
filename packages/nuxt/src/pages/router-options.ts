import fs from 'node:fs'
import { resolve } from 'pathe'
import { findPath } from '@nuxt/kit'
import { genImport, genObjectFromRawEntries, genString } from 'knitwork'
import { parseAndWalk } from 'oxc-walker'

import { unwrapStaticExpression } from '../core/utils/parse-utils.ts'
import type { Nuxt } from 'nuxt/schema'

/** Contents of `#build/router.options.mjs`, merging `router.options` config with every `router.options` file. */
export async function genRouterOptions (nuxt: Nuxt, builtInRouterOptions: string) {
  const routerOptionsFiles = await resolveRouterOptions(nuxt, builtInRouterOptions)

  const configRouterOptions = genObjectFromRawEntries(Object.entries(nuxt.options.router.options)
    .map(([key, value]) => [key, genString(value as string)]))

  const hashModes: string[] = []
  for (let index = 0; index < routerOptionsFiles.length; index++) {
    if (routerOptionsFiles[index]!.path !== builtInRouterOptions) {
      hashModes.unshift(`routerOptions${index}.hashMode`)
    }
  }

  return [
    ...routerOptionsFiles.map((file, index) => genImport(file.path, `routerOptions${index}`)),
    `const configRouterOptions = ${configRouterOptions}`,
    `export const hashMode = ${[...hashModes, nuxt.options.router.options.hashMode].join(' ?? ')}`,
    'export default {',
    '...configRouterOptions,',
    ...routerOptionsFiles.map((_, index) => `...routerOptions${index},`),
    '}',
  ].join('\n')
}

/**
 * The `router.options` files of the app, in the order they are merged: the built-in options
 * (when given, marked `optional`), then each layer's file, then any added by the
 * `pages:routerOptions` hook.
 */
export async function resolveRouterOptions (nuxt: Nuxt, builtInRouterOptions?: string) {
  const context = {
    files: [] as Array<{ path: string, optional?: boolean }>,
  }

  for (const layer of nuxt.options._layers) {
    const path = await findPath(resolve(layer.config.srcDir, layer.config.dir?.app || 'app', 'router.options'))
    if (path) { context.files.unshift({ path }) }
  }

  if (builtInRouterOptions) {
    context.files.unshift({ path: builtInRouterOptions, optional: true })
  }

  await nuxt.callHook('pages:routerOptions', context)
  return context.files
}

/**
 * The first non-optional `router.options` file that may define `key` (see
 * {@link routerOptionsMayDefine}), counting files that cannot be read.
 */
export async function findRouterOptionsFileDefining (nuxt: Nuxt, key: RouterOptionsKey, builtInRouterOptions?: string): Promise<string | undefined> {
  for (const file of await resolveRouterOptions(nuxt, builtInRouterOptions)) {
    if (file.optional) { continue }
    const code = await fs.promises.readFile(file.path, 'utf-8').catch(() => undefined)
    if (code === undefined || routerOptionsMayDefine(code, file.path, key)) {
      return file.path
    }
  }
}

/**
 * Statically determine whether a `router.options` file may define `key`.
 * Returns `true` (conservatively) when the default export is not a plain object
 * literal, contains spreads or computed keys, or defines `key`.
 */
type RouterOptionsKey = 'routes' | 'sensitive' | 'hashMode' | 'history' | 'strict'

export function routerOptionsMayDefine (code: string, filename: string, key: RouterOptionsKey): boolean {
  let mayDefine = true
  try {
    parseAndWalk(code, filename, (node) => {
      if (node.type !== 'ExportDefaultDeclaration') { return }
      const declaration = unwrapStaticExpression(node.declaration)
      if (declaration?.type !== 'ObjectExpression') { return }
      mayDefine = declaration.properties.some((property) => {
        if (property.type === 'SpreadElement') { return true }
        const propertyKey = property.key
        const name = propertyKey.type === 'Identifier' && !property.computed ? propertyKey.name : propertyKey.type === 'Literal' ? String(propertyKey.value) : undefined
        return name === undefined || name === key
      })
    })
  } catch {
    return true
  }
  return mayDefine
}
