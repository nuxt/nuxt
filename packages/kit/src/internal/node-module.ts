import { fileURLToPath } from 'node:url'
import { normalize } from 'pathe'
import { joinURL } from 'ufo'
import { readPackageJSON } from 'pkg-types'
import type { PackageJson } from 'pkg-types'

type Exports = Exclude<PackageJson['exports'], undefined>

const NODE_MODULES_SEGMENT = '/node_modules/'

export interface ParsedNodeModulePath {
  dir?: string
  name?: string
  subpath?: string
}

function toPath (path: string | URL): string {
  return normalize(typeof path === 'string' && !path.startsWith('file://') ? path.replace(/\\/g, '/') : fileURLToPath(path).replace(/\\/g, '/'))
}

/**
 * Split a path within `node_modules` into the containing `node_modules` directory,
 * the package name and the subpath within the package.
 */
export function parseNodeModulePath (path: string | URL): ParsedNodeModulePath {
  if (!path) {
    return {}
  }

  const resolvedPath = toPath(path)
  const index = resolvedPath.lastIndexOf(NODE_MODULES_SEGMENT)
  if (index === -1) {
    return {}
  }

  const dir = resolvedPath.slice(0, index + NODE_MODULES_SEGMENT.length)
  const segments = resolvedPath.slice(dir.length).split('/')
  const name = segments.splice(0, segments[0]?.startsWith('@') ? 2 : 1).join('/')
  if (!name) {
    return {}
  }

  const subpath = segments.join('/')
  return { dir, name, subpath: subpath ? `./${subpath}` : undefined }
}

/**
 * Resolve the public subpath (as exposed through the package `exports` field, if any)
 * that corresponds to a resolved file within `node_modules`.
 */
export async function lookupNodeModuleSubpath (path: string | URL): Promise<string | undefined> {
  const resolvedPath = toPath(path)
  const { name, subpath } = parseNodeModulePath(resolvedPath)

  if (!name || !subpath) {
    return subpath
  }

  const { exports } = await readPackageJSON(resolvedPath).catch(() => undefined) || {}

  return (exports && findSubpath(subpath, exports)) || subpath
}

function findSubpath (subpath: string, exports: Exports): string | undefined {
  if (typeof exports === 'string') {
    exports = { '.': exports }
  }

  if (!subpath.startsWith('.')) {
    subpath = subpath.startsWith('/') ? `.${subpath}` : `./${subpath}`
  }

  if (subpath in exports) {
    return subpath
  }

  return flattenExports(exports).find(p => p.fsPath === subpath)?.subpath
}

function flattenExports (exports: Exports, parentSubpath = './'): Array<{ subpath: string, fsPath: string }> {
  if (typeof exports === 'string') {
    return [{ subpath: parentSubpath, fsPath: exports }]
  }

  if (Array.isArray(exports)) {
    return exports.flatMap(value => flattenExports(value, parentSubpath))
  }

  return Object.entries(exports).flatMap(([key, value]) => {
    const childSubpath = joinURL(parentSubpath, key.startsWith('.') ? key.slice(1) : '')

    if (typeof value === 'string') {
      return [{ subpath: childSubpath, fsPath: value }]
    }

    return flattenExports(value as Exports, childSubpath)
  })
}
