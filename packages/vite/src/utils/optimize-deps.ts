import { existsSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, join, normalize } from 'pathe'
import { withTrailingSlash } from 'ufo'
import { resolveModulePath } from 'exsolve'
import { escapePath } from 'tinyglobby'
import { getLayerDirectories, packageName } from '@nuxt/kit'
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
 * Vite matches every entry with picomatch, so paths are escaped. A project directory may
 * contain parentheses, which picomatch reads as an extglob group and then matches nothing.
 */
export function installedScanEntries (nuxt: Nuxt): string[] {
  const entries = new Set<string>()
  const projectRoot = withTrailingSlash(nuxt.options.rootDir)
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

  for (const dirs of getLayerDirectories(nuxt)) {
    if (dirs.root === projectRoot) { continue }
    const app = withTrailingSlash(dirs.app)
    if (!app.includes(NODE_MODULES)) { continue }
    const dir = escapePath(app)
    entries.add(`${dir}**/*.${SCAN_EXTENSIONS}`)
    // scanning the layer's own dependency tree is unnecessary and slow
    entries.add(`!${dir}**/node_modules/**`)
    // a v3 layer has `srcDir === rootDir`, so its server and build-time code sits under the glob
    for (const excluded of [dirs.server, dirs.modules, dirs.public]) {
      const path = withTrailingSlash(excluded)
      if (path !== app && path.startsWith(app) && existsSync(path)) {
        entries.add(`!${escapePath(path)}**`)
      }
    }
    entries.add(`!${dir}**/*.server.${SCAN_EXTENSIONS}`)
    for (const file of serverFiles) {
      if (file.startsWith(app)) { entries.add('!' + escapePath(file)) }
    }
  }

  // the build directory is often inside `node_modules`, and its templates are generated
  // app code Vite already reaches through the entry
  const buildDir = withTrailingSlash(nuxt.options.buildDir)
  for (const app of apps) {
    const files = [
      ...app.components.filter(c => c.mode !== 'server').map(c => c.filePath),
      ...app.plugins.filter(p => p.mode !== 'server').map(p => p.src),
      ...app.middleware.map(m => m.path),
      ...Object.values(app.layouts || {}).map(l => l.file),
    ].map(normalize)
    for (const file of files) {
      if (file.includes(NODE_MODULES) && !file.startsWith(buildDir) && !SERVER_FILE_RE.test(file)) {
        entries.add(escapePath(file))
      }
    }
  }

  return [...entries]
}

/**
 * Rewrites `optimizeDeps.include` entries that only resolve from an installed layer into
 * Vite's nested `parent > dep` form, resolved relative to the parent package rather than
 * the project root.
 *
 * One entry can resolve to several distinct copies of a package, so each input entry maps
 * to an array of output entries, aligned by index.
 */
export function resolveOptimizeDepsInclude (nuxt: Nuxt, include: string[], options: { preserveSymlinks?: boolean } = {}): string[][] {
  const rootDir = normalize(nuxt.options.rootDir)
  const projectRoot = withTrailingSlash(rootDir)
  const realPathCache = new Map<string, string>()
  const packageDirCache = new Map<string, string | undefined>()

  function realPath (path: string) {
    const normalized = normalize(path)
    const cached = realPathCache.get(normalized)
    if (cached) { return cached }
    const resolved = normalize(realpathSync(normalized))
    realPathCache.set(normalized, resolved)
    return resolved
  }

  /** Find the `node_modules` directory `name` installs into, searching up from `dir`. */
  function resolvePackageDir (name: string, dir: string) {
    let directory = normalize(dir)
    const key = `${directory}\0${name}`
    if (packageDirCache.has(key)) { return packageDirCache.get(key) }

    while (true) {
      const candidate = join(directory, 'node_modules', name)
      if (existsSync(candidate)) {
        const resolved = normalize(candidate)
        packageDirCache.set(key, resolved)
        return resolved
      }
      const parent = dirname(directory)
      if (parent === directory) {
        packageDirCache.set(key, undefined)
        return
      }
      directory = parent
    }
  }

  function isResolvableFrom (id: string, dir: string) {
    return !!resolveModulePath(id, { from: dir, try: true, extensions: ['.mjs', '.js', '.cjs', '.json'] })
  }

  // Vite resolves symlinked copies to one dependency unless `preserveSymlinks` is set.
  function dependencyIdentity (dir: string) {
    return options.preserveSymlinks ? dir : realPath(dir)
  }

  const layers: Array<{ name: string, root: string, identity: string }> = []
  for (const dirs of getLayerDirectories(nuxt)) {
    if (dirs.root === projectRoot) { continue }
    // Vite needs the installed alias, which can differ from the package manifest name.
    const { dir, name } = parseNodeModulePath(dirs.root)
    if (!dir || !name || !existsSync(dir + name)) { continue }
    layers.push({ name, root: normalize(dirs.root), identity: realPath(dir + name) })
  }

  // Walk out from the project so every layer keeps the full chain Vite resolves it through.
  const layerChains = new Map<string, string[]>()
  const queue: Array<{ dir: string, chain: string[] }> = [{ dir: rootDir, chain: [] }]
  for (const { dir, chain } of queue) {
    for (const layer of layers) {
      if (layerChains.has(layer.root)) { continue }
      const packageDir = resolvePackageDir(layer.name, dir)
      if (!packageDir || realPath(packageDir) !== layer.identity) { continue }
      const layerChain = [...chain, layer.name]
      layerChains.set(layer.root, layerChain)
      queue.push({ dir: layer.root, chain: layerChain })
    }
  }

  if (!layerChains.size) { return include.map(entry => [entry]) }

  return include.map((entry) => {
    if (entry.includes('>') || entry.startsWith('.') || isAbsolute(entry)) { return [entry] }

    // one entry per distinct copy of the package, keyed by the identity Vite resolves it to
    const resolved = new Map<string, string>()
    const name = packageName(entry)
    const rootPackage = resolvePackageDir(name, rootDir)
    if (rootPackage && isResolvableFrom(entry, rootDir)) {
      resolved.set(dependencyIdentity(rootPackage), entry)
    }

    for (const [layerRoot, chain] of layerChains) {
      const packageDir = resolvePackageDir(name, layerRoot)
      if (!packageDir) { continue }
      const identity = dependencyIdentity(packageDir)
      if (resolved.has(identity) || !isResolvableFrom(entry, layerRoot)) { continue }
      resolved.set(identity, `${chain.join(' > ')} > ${entry}`)
    }

    return resolved.size ? [...resolved.values()] : [entry]
  })
}
