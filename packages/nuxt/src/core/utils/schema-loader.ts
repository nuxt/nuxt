import nodeModule from 'node:module'
import { readFileSync, realpathSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Jiti } from 'jiti'
import { annotateSchemaSource } from './schema-annotations.ts'

const SCHEMA_IMPORT_PARAM = 'nuxt-schema'
const NODE_MODULES_RE = /[\\/]node_modules[\\/]/
const PACKAGE_ROOT_RE = /^.*[\\/]node_modules[\\/](?:@[^\\/]+[\\/])?[^\\/]+[\\/]/
const ANNOTATED_FORMATS = new Set(['module', 'module-typescript', 'commonjs', 'commonjs-typescript'])

let importCount = 0

/** Whether the runtime supports the synchronous module hooks that {@link importSchema} relies on. */
export const canImportSchema = typeof nodeModule.registerHooks === 'function'

/**
 * Import a schema file with the runtime's own loader, adding the `$schema` markup described by
 * its JSDoc annotations, and by those of the files it imports from its own package or project.
 *
 * Every call evaluates the file and its local imports afresh, so that edits are picked up.
 *
 * @param filePath absolute path of the schema file
 * @returns the default export of the schema file
 */
export async function importSchema (filePath: string): Promise<unknown> {
  const id = String(++importCount)
  const entry = pathToFileURL(tryRealpath(filePath))
  entry.searchParams.set(SCHEMA_IMPORT_PARAM, id)
  const packageRoot = PACKAGE_ROOT_RE.exec(entry.href)?.[0] ?? 'file:'
  // `require()` drops the query, so files reached through it are tracked by path
  const files = new Set<string>()
  const isSchemaImport = (url: string | undefined) => {
    if (!url?.startsWith('file:')) {
      return false
    }
    const parsed = new URL(url)
    const param = parsed.searchParams.get(SCHEMA_IMPORT_PARAM)
    return param === id || (param === null && files.has(fileURLToPath(parsed)))
  }

  const hooks = nodeModule.registerHooks({
    resolve (specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context)
      if (!isSchemaImport(context.parentURL) || !resolved.url.startsWith(packageRoot) || NODE_MODULES_RE.test(resolved.url.slice(packageRoot.length))) {
        return resolved
      }
      if (context.conditions?.includes('require')) {
        files.add(fileURLToPath(resolved.url))
        return resolved
      }
      const url = new URL(resolved.url)
      url.searchParams.set(SCHEMA_IMPORT_PARAM, id)
      return { ...resolved, url: url.href }
    },
    load (url, context, nextLoad) {
      const loaded = nextLoad(url, context)
      if (!isSchemaImport(url) || !loaded.format || !ANNOTATED_FORMATS.has(loaded.format)) {
        return loaded
      }
      const path = fileURLToPath(url)
      files.add(path)
      const source = loaded.source ?? readFileSync(path)
      return { ...loaded, source: annotateSchemaSource(typeof source === 'string' ? source : Buffer.from(source as Uint8Array).toString('utf8'), path) }
    },
  })

  try {
    const mod = await import(entry.href)
    return mod.default ?? mod
  } catch (error) {
    if (error instanceof Error) {
      error.message = error.message.replaceAll(`?${SCHEMA_IMPORT_PARAM}=${id}`, '')
    }
    throw error
  } finally {
    hooks.deregister()
    for (const file of files) {
      delete requireCache[file]
    }
  }
}

const requireCache = nodeModule.createRequire(import.meta.url).cache

function tryRealpath (path: string) {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

/**
 * Create a jiti instance that adds the `$schema` markup described by JSDoc annotations to every
 * file it transforms.
 *
 * @param jiti the `jiti` module
 * @param from file to resolve imports from
 */
export function createSchemaJiti (jiti: typeof import('jiti'), from: string): Jiti {
  const options = { fsCache: false, moduleCache: false }
  const base = jiti.createJiti(from, options)
  return jiti.createJiti(from, {
    ...options,
    transform: transformOptions => ({
      code: base.transform({
        ...transformOptions,
        source: annotateSchemaSource(transformOptions.source, transformOptions.filename || 'nuxt.schema.ts'),
      }),
    }),
  })
}
