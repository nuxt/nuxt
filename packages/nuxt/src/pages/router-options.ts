import { readFile } from 'node:fs/promises'
import { resolve } from 'pathe'
import { findPath } from '@nuxt/kit'
import { pageDiagnostics } from '@nuxt/kit/internal'
import { genImport, genObjectFromRawEntries, genString } from 'knitwork'
import { parseAndWalk } from 'oxc-walker'

import { linkToAlias } from '../utils.ts'
import { unwrapStaticExpression } from './page-meta-extraction.ts'
import type { Nuxt } from 'nuxt/schema'

/** Contents of `#build/router.options.mjs`, merging `router.options` config with every `router.options` file. */
export async function genRouterOptions (nuxt: Nuxt, builtInRouterOptions: string) {
  const routerOptionsFiles = await resolveRouterOptions(nuxt, builtInRouterOptions)
  for (const file of routerOptionsFiles) {
    if (file.path === builtInRouterOptions) { continue }
    const code = await readFile(file.path, 'utf-8').catch(() => undefined)
    if (code !== undefined && getRouterOptionsKeys(code, file.path)?.has('sensitive')) {
      throw pageDiagnostics.NUXT_B4023({ file: linkToAlias(file.path, nuxt) })
    }
  }

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
    `sensitive: ${!!nuxt.options.router.options.sensitive},`,
    '}',
  ].join('\n')
}

/** The `router.options` files of every layer, after the built-in defaults and as extended by `pages:routerOptions`. */
export async function resolveRouterOptions (nuxt: Nuxt, builtInRouterOptions: string) {
  const context = {
    files: [] as Array<{ path: string, optional?: boolean }>,
  }

  for (const layer of nuxt.options._layers) {
    const path = await findPath(resolve(layer.config.srcDir, layer.config.dir?.app || 'app', 'router.options'))
    if (path) { context.files.unshift({ path }) }
  }

  context.files.unshift({ path: builtInRouterOptions, optional: true })

  await nuxt.callHook('pages:routerOptions', context)
  return context.files
}

/** The first `router.options` file that may modify `routes`, or set any of `keys`. */
export async function findRoutesModifyingRouterOptions (nuxt: Nuxt, builtInRouterOptions: string, keys: string[] = []) {
  for (const file of await resolveRouterOptions(nuxt, builtInRouterOptions)) {
    if (file.optional) { continue }
    const code = await readFile(file.path, 'utf-8').catch(() => undefined)
    if (code === undefined || routerOptionsMayModifyRoutes(code, file.path)) {
      return file
    }
    if (keys.length) {
      const fileKeys = getRouterOptionsKeys(code, file.path)
      if (keys.some(key => fileKeys?.has(key))) { return file }
    }
  }
}

/**
 * Statically determine whether a `router.options` file may modify `routes`.
 * Returns `true` (conservatively) when the default export is not a plain object
 * literal, contains spreads or computed keys, or defines a `routes` property.
 */
export function routerOptionsMayModifyRoutes (code: string, filename: string): boolean {
  const keys = getRouterOptionsKeys(code, filename)
  return !keys || keys.has('routes')
}

/**
 * The keys of the object literal a `router.options` file exports by default, or `undefined`
 * when the export cannot be analysed or contains spreads or computed keys.
 */
export function getRouterOptionsKeys (code: string, filename: string): Set<string> | undefined {
  let keys: Set<string> | undefined
  try {
    parseAndWalk(code, filename, (node) => {
      if (node.type !== 'ExportDefaultDeclaration') { return }
      const declaration = unwrapStaticExpression(node.declaration)
      if (declaration?.type !== 'ObjectExpression') { return }
      const names = new Set<string>()
      for (const property of declaration.properties) {
        if (property.type === 'SpreadElement') { return }
        const key = property.key
        const name = key.type === 'Identifier' && !property.computed ? key.name : key.type === 'Literal' ? String(key.value) : undefined
        if (name === undefined) { return }
        names.add(name)
      }
      keys = names
    })
  } catch {
    return undefined
  }
  return keys
}
