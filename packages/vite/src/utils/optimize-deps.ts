import { existsSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, join, normalize } from 'pathe'
import { withTrailingSlash } from 'ufo'
import { resolveModulePath } from 'exsolve'
import { escapePath } from 'tinyglobby'
import { getLayerDirectories } from '@nuxt/kit'
import { parseNodeModulePath } from '@nuxt/kit/internal'
import type { Nuxt } from '@nuxt/schema'

const NODE_MODULES = '/node_modules/'
const SCAN_EXTENSIONS = '{vue,js,jsx,mjs,ts,tsx,mts}'
const SERVER_FILE_RE = /\.server\.(?:vue|js|jsx|mjs|ts|tsx|mts)$/

/**
 * Scanner entries for app code that lives in `node_modules`, such as an installed layer
 * or a plugin a module registers from its own runtime directory.
 *
 * Vite does not pre-bundle a bare import whose importer is in `node_modules`, so without
 * these its dependencies are served raw, breaking if they are CJS-only.
 *
 * Vite matches every entry with picomatch, so paths are escaped: a package manager can
 * install into a directory whose name contains glob characters, as pnpm does.
 */
export function installedScanEntries (nuxt: Nuxt): string[] {
  const entries = new Set<string>()
  const apps = Object.values(nuxt.apps)
  const serverFiles = apps.flatMap(app => [
    ...app.components.filter(c => c.mode === 'server').map(c => c.filePath),
    ...app.plugins.filter(p => p.mode === 'server').map(p => p.src),
  ]).map(normalize)
  const pages = apps.flatMap(app => app.pages || [])
  for (const page of pages) {
    pages.push(...page.children || [])
    if (page.mode !== 'server') { continue }
    if (page.file) { serverFiles.push(normalize(page.file)) }
    serverFiles.push(...Object.values(page.components || {}).map(normalize))
  }

  for (const dirs of getLayerDirectories(nuxt).slice(1)) {
    const app = withTrailingSlash(normalize(dirs.app))
    if (!app.includes(NODE_MODULES)) { continue }
    const dir = escapePath(app)
    entries.add(`${dir}**/*.${SCAN_EXTENSIONS}`)
    // scanning the layer's own dependency tree is unnecessary and slow
    entries.add(`!${dir}**/node_modules/**`)
    // a v3 layer has `srcDir === rootDir`, so its server and build-time code sits under the glob
    for (const excluded of [dirs.server, dirs.modules, dirs.public]) {
      const path = withTrailingSlash(normalize(excluded))
      if (path !== app && path.startsWith(app) && existsSync(path)) {
        entries.add(`!${escapePath(path)}**`)
      }
    }
    entries.add(`!${dir}**/*.server.${SCAN_EXTENSIONS}`)
    for (const file of serverFiles) {
      if (file.startsWith(app)) { entries.add('!' + escapePath(file)) }
    }
  }

  for (const app of apps) {
    const files = [
      ...app.components.filter(c => c.mode !== 'server').map(c => c.filePath),
      ...app.plugins.filter(p => p.mode !== 'server').map(p => p.src),
      ...app.middleware.map(m => m.path),
      ...Object.values(app.layouts || {}).map(l => l.file),
    ].map(normalize)
    for (const file of files) {
      if (file.includes(NODE_MODULES) && !SERVER_FILE_RE.test(file)) {
        entries.add(escapePath(file))
      }
    }
  }

  return [...entries]
}

function packageName (entry: string) {
  const segments = entry.split('/')
  return entry.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]!
}

/**
 * Creates a cached resolver for Vite's nested dependency syntax. The layer graph and
 * package resolutions are shared across every include list for one Vite environment.
 */
export function createOptimizeDepsIncludeResolver (nuxt: Nuxt, options: { preserveSymlinks?: boolean } = {}) {
  const rootDir = normalize(nuxt.options.rootDir)
  const realPathCache = new Map<string, string>()
  const packageRootCache = new Map<string, string | undefined>()

  function realPath (path: string) {
    const normalized = normalize(path)
    const cached = realPathCache.get(normalized)
    if (cached) { return cached }
    const resolved = normalize(realpathSync(normalized))
    realPathCache.set(normalized, resolved)
    return resolved
  }

  function resolvePackageRoot (name: string, from: string) {
    let directory = normalize(from)
    const key = `${directory}\0${name}`
    if (packageRootCache.has(key)) { return packageRootCache.get(key) }

    while (true) {
      const candidate = join(directory, 'node_modules', name)
      if (existsSync(candidate)) {
        const resolved = normalize(candidate)
        packageRootCache.set(key, resolved)
        return resolved
      }
      const parent = dirname(directory)
      if (parent === directory) {
        packageRootCache.set(key, undefined)
        return
      }
      directory = parent
    }
  }

  function isResolvable (id: string, from: string) {
    return !!resolveModulePath(id, { from, try: true, extensions: ['.mjs', '.js', '.cjs', '.json'] })
  }

  function dependencyIdentity (root: string) {
    return options.preserveSymlinks ? root : realPath(root)
  }

  const layers: Array<{ name: string, root: string, identity: string }> = []
  for (const dirs of getLayerDirectories(nuxt).slice(1)) {
    // Vite needs the installed alias, which can differ from the package manifest name.
    const { dir, name } = parseNodeModulePath(dirs.root)
    if (!dir || !name || !existsSync(dir + name)) { continue }
    layers.push({ name, root: normalize(dirs.root), identity: realPath(dir + name) })
  }

  // Walk out from the project so every layer keeps the full chain Vite resolves it through.
  const layerChains = new Map<string, string[]>()
  const queue: Array<{ root: string, chain: string[] }> = [{ root: rootDir, chain: [] }]
  for (const { root, chain } of queue) {
    for (const layer of layers) {
      if (layerChains.has(layer.root)) { continue }
      const packageRoot = resolvePackageRoot(layer.name, root)
      if (!packageRoot || realPath(packageRoot) !== layer.identity) { continue }
      const layerChain = [...chain, layer.name]
      layerChains.set(layer.root, layerChain)
      queue.push({ root: layer.root, chain: layerChain })
    }
  }

  if (!layerChains.size) { return (include: string[]) => include }

  const entryCache = new Map<string, string[]>()
  function resolveEntry (entry: string): string[] {
    const cached = entryCache.get(entry)
    if (cached) { return cached }
    if (entry.includes('>') || entry.startsWith('.') || isAbsolute(entry)) { return [entry] }

    const resolvedEntries = new Map<string, string>()
    const name = packageName(entry)
    const rootPackage = resolvePackageRoot(name, rootDir)
    if (rootPackage && isResolvable(entry, rootDir)) {
      resolvedEntries.set(dependencyIdentity(rootPackage), entry)
    }

    for (const [root, chain] of layerChains) {
      const packageRoot = resolvePackageRoot(name, root)
      if (!packageRoot) { continue }
      const identity = dependencyIdentity(packageRoot)
      if (resolvedEntries.has(identity) || !isResolvable(entry, root)) { continue }
      resolvedEntries.set(identity, `${chain.join(' > ')} > ${entry}`)
    }

    const entries = resolvedEntries.size ? [...resolvedEntries.values()] : [entry]
    entryCache.set(entry, entries)
    return entries
  }

  return (include: string[]) => include.flatMap(resolveEntry)
}
