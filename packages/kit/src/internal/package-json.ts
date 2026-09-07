import process from 'node:process'
import { statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, normalize, resolve } from 'pathe'
import { resolveModulePath } from 'exsolve'
import type { PackageJson } from 'pkg-types'

interface ResolveOptions {
  from?: string | URL | Array<string | URL>
  parent?: string | URL
  try?: boolean
}

const WORKSPACE_FILES = ['pnpm-workspace.yaml', 'lerna.json', 'turbo.json', 'rush.json', 'deno.json', 'deno.jsonc']
const LOCK_FILES = ['yarn.lock', 'package-lock.json', 'pnpm-lock.yaml', 'npm-shrinkwrap.json', 'bun.lockb', 'bun.lock', 'deno.lock']

function isFile (path: string) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function resolveStartPath (id: string | URL, options: ResolveOptions): string | undefined {
  if (id instanceof URL || id.startsWith('file://')) {
    return normalize(fileURLToPath(id))
  }
  if (isAbsolute(id)) {
    return normalize(id)
  }
  return resolveModulePath(id, { ...options, from: options.from || options.parent })
}

/** Walk up from `start` looking for one of `filenames`, stopping at the nearest `node_modules`. */
function findUp (start: string, filenames: string[], furthest?: boolean) {
  const segments = resolve(start).split('/').filter(Boolean)
  if (start[0] === '/') {
    segments[0] = '/' + segments[0]
  }
  const root = Math.max(segments.findIndex(s => s === 'node_modules'), 0)
  const length = segments.length - root
  for (let i = 0; i < length; i++) {
    const index = furthest ? root + 1 + i : segments.length - i
    for (const filename of filenames) {
      const candidate = join(...segments.slice(0, index), filename)
      if (isFile(candidate)) {
        return candidate
      }
    }
  }
}

/** Find the `package.json` nearest to `id`, which may be a path, a URL or a module id. */
export function resolvePackageJSON (id: string | URL = process.cwd(), options: ResolveOptions = {}): string | undefined {
  // `resolveStartPath` returns `undefined` for an unresolvable module id when `try` is set
  const start = resolveStartPath(id, options)
  const path = start ? findUp(start, ['package.json']) : undefined
  if (!path && !options.try) {
    throw new Error(`Cannot find matching package.json in ${id} or parent directories.`)
  }
  return path
}

/** Find the directory containing the `package.json` nearest to `id`. */
export function resolvePackageDir (id: string | URL, options: ResolveOptions = {}): string | undefined {
  const path = resolvePackageJSON(id, options)
  return path ? dirname(path) : undefined
}

/** Read the `package.json` nearest to `id`, which may be a path, a URL or a module id. */
export async function readPackageJSON (id: string | URL = process.cwd(), options: ResolveOptions = {}): Promise<PackageJson> {
  const path = resolvePackageJSON(id, options)!
  return JSON.parse(await readFile(path, 'utf8')) as PackageJson
}

/**
 * Detect the workspace root for `id`, preferring workspace manifests, then git, then lockfiles.
 *
 * Returns a promise because the inlined `c12` awaits this and attaches a `.catch()` to it.
 *
 * @knipignore reached only through the `pkg-types` alias in `tsdown.config.ts`
 */
export function findWorkspaceDir (id: string | URL = process.cwd(), options: ResolveOptions = {}): Promise<string> {
  return Promise.resolve().then(() => resolveWorkspaceDir(id, options))
}

function resolveWorkspaceDir (id: string | URL, options: ResolveOptions): string {
  const start = resolveStartPath(id, options)
  if (!start) {
    throw new Error(`Cannot detect workspace root from ${id}.`)
  }

  const workspaceFile = findUp(start, WORKSPACE_FILES, true)
  if (workspaceFile) {
    return dirname(workspaceFile)
  }

  const gitConfig = findUp(start, ['.git/config'])
  if (gitConfig) {
    return resolve(gitConfig, '../..')
  }

  const lockFile = findUp(start, LOCK_FILES, true)
  if (lockFile) {
    return dirname(lockFile)
  }

  const packageJSON = findUp(start, ['package.json'], true)
  if (packageJSON) {
    return dirname(packageJSON)
  }

  throw new Error(`Cannot detect workspace root from ${id}.`)
}
