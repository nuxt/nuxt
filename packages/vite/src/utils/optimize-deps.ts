import { basename, dirname, isAbsolute, join, relative, resolve } from 'pathe'
import { resolveModulePath } from 'exsolve'
import { readPackageJSON } from 'pkg-types'
import { convertPathToPattern } from 'tinyglobby'
import { getLayerDirectories, resolveAlias, resolveFiles, runWithNuxtContext } from '@nuxt/kit'
import type { Nuxt, NuxtPage } from '@nuxt/schema'

const NODE_MODULES = '/node_modules/'
const SCRIPT_FILES = '*.{mts,cts,ts,tsx,mjs,cjs,js,jsx}'
const FILE_EXTENSION_RE = /\.(?:\w+|\{[\w,]+\})$/
const PLAIN_FILE_NAME_RE = /^[\w@-]+(?:\.[\w@-]+)*$/

interface RegisteredFile {
  file?: string | null
  mode?: 'client' | 'server' | 'all'
}

/**
 * Scanner entries for the files Nuxt reaches through generated modules: the app, root and error
 * components, pages, layouts, middleware, components, plugins, app configs and auto-imported
 * composables and utils. Server-only pages, components and plugins are left out.
 *
 * Vite's scanner cannot follow generated modules, so without these entries the dependencies of
 * these files are only found while the first page loads, and each new batch reloads the page.
 *
 * The app directory of an installed layer is scanned as a whole, so files it only reaches through
 * its own aliases are covered too.
 */
export async function appScanEntries (nuxt: Nuxt): Promise<string[]> {
  const files = new Set<string>()
  const serverFiles = new Set<string>()

  for (const app of Object.values(nuxt.apps)) {
    const registered: RegisteredFile[] = [
      ...[app.mainComponent, app.rootComponent, app.errorComponent, ...app.configs].map(file => ({ file })),
      ...pageFiles(app.pages),
      ...Object.values(app.layouts || {}).map(l => ({ file: l.file })),
      ...app.middleware.map(m => ({ file: m.path })),
      ...app.components.map(c => ({ file: c.filePath, mode: c.mode })),
      ...app.plugins.map(p => ({ file: p.src, mode: p.mode })),
    ]
    for (const { file, mode } of registered) {
      if (file && isAbsolute(file)) {
        (mode === 'server' ? serverFiles : files).add(file)
      }
    }
  }

  for (const file of await importsDirFiles(nuxt)) {
    files.add(file)
  }

  const entries = toEntryPatterns(files)

  for (const dirs of getLayerDirectories(nuxt).slice(1)) {
    if (dirs.app.includes(NODE_MODULES)) {
      const appDir = convertPathToPattern(dirs.app)
      entries.push(`${appDir}**/*.{vue,js,jsx,mjs,ts,tsx,mts}`, `!${appDir}**/node_modules/**`)
    }
  }
  for (const file of serverFiles) {
    if (file.includes(NODE_MODULES)) {
      entries.push('!' + convertPathToPattern(file))
    }
  }

  return entries
}

/**
 * Vite globs the scan entries and matches each crawled path against every pattern, so the files
 * are grouped by directory where their names allow it.
 */
function toEntryPatterns (files: Iterable<string>): string[] {
  const patterns: string[] = []
  const namesByDir = new Map<string, string[]>()
  for (const file of files) {
    const name = basename(file)
    if (!PLAIN_FILE_NAME_RE.test(name)) {
      patterns.push(convertPathToPattern(file))
      continue
    }
    const dir = dirname(file)
    const names = namesByDir.get(dir)
    if (names) {
      names.push(name)
    } else {
      namesByDir.set(dir, [name])
    }
  }
  for (const [dir, names] of namesByDir) {
    patterns.push(`${convertPathToPattern(dir)}/${names.length === 1 ? names[0] : `{${names.join(',')}}`}`)
  }
  return patterns
}

function* pageFiles (pages: NuxtPage[] = []): Generator<RegisteredFile> {
  for (const page of pages) {
    yield { file: page.file, mode: page.mode }
    for (const file of Object.values(page.components || {})) {
      yield { file, mode: page.mode }
    }
    yield* pageFiles(page.children)
  }
}

async function importsDirFiles (nuxt: Nuxt): Promise<string[]> {
  if (nuxt.options.imports.scan === false) { return [] }

  const layerDirs = getLayerDirectories(nuxt)
  const files: string[] = []

  for (const [index, layer] of nuxt.options._layers.entries()) {
    if (layer.config?.imports?.scan === false) { continue }
    const dirs = layerDirs[index]!
    const patterns = [
      join(dirs.app, 'composables'),
      join(dirs.app, 'utils'),
      join(dirs.shared, 'utils'),
      ...(layer.config.imports?.dirs ?? []).filter((dir): dir is string => !!dir).map(dir => resolve(dirs.app, resolveAlias(dir, nuxt.options.alias))),
    ].map((dir) => {
      const pattern = relative(dirs.app, dir)
      return FILE_EXTENSION_RE.test(pattern) ? pattern : join(pattern.endsWith('/*') ? dirname(pattern) : pattern, SCRIPT_FILES)
    })
    // `resolveFiles` reads the ignore patterns from the Nuxt context
    files.push(...await runWithNuxtContext(nuxt, () => resolveFiles(dirs.app, patterns)))
  }

  return files
}

function isResolvableFrom (id: string, dir: string) {
  return !!resolveModulePath(id, { from: dir, try: true, extensions: ['.mjs', '.js', '.cjs', '.json'] })
}

/**
 * Rewrites `optimizeDeps.include` entries that only resolve from an installed layer into
 * Vite's nested `parent > dep` form, resolved relative to the parent package rather than
 * the project root.
 */
export async function resolveOptimizeDepsInclude (nuxt: Nuxt, include: string[]): Promise<string[]> {
  const layers: Array<{ name: string, root: string }> = []
  for (const dirs of getLayerDirectories(nuxt)) {
    if (dirs.root === nuxt.options.rootDir + '/' || !dirs.root.includes(NODE_MODULES)) { continue }
    const name = await readPackageJSON(dirs.root).then(pkg => pkg.name).catch(() => undefined)
    if (name) { layers.push({ name, root: dirs.root }) }
  }

  if (!layers.length) { return include }

  return include.map((entry) => {
    if (entry.includes('>') || entry.startsWith('.') || isAbsolute(entry)) { return entry }
    if (isResolvableFrom(entry, nuxt.options.rootDir + '/')) { return entry }

    for (const layer of layers) {
      if (isResolvableFrom(entry, layer.root)) {
        return `${layer.name} > ${entry}`
      }
    }

    return entry
  })
}
