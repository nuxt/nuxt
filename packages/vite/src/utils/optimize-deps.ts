import { isAbsolute, join } from 'pathe'
import { resolveModulePath } from 'exsolve'
import { readPackageJSON } from 'pkg-types'
import { getLayerDirectories } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'

const NODE_MODULES = '/node_modules/'

/**
 * Scanner entries for the app code of every layer, and for app files a module registers
 * from its own runtime directory in `node_modules`.
 *
 * Vite's scanner starts from the entry, but plugins, pages, layouts and components are
 * reached through generated (virtual) modules it cannot follow. Without these entries their
 * dependencies are found while the first page loads, and each new batch reloads the page.
 * Vite also does not pre-bundle a bare import whose importer is in `node_modules`, so an
 * installed layer's dependencies would otherwise be served raw, breaking if they are CJS-only.
 */
export function appScanEntries (nuxt: Nuxt): string[] {
  const entries = new Set<string>()
  const ignore = nuxt.options.ignore.filter(pattern => !pattern.startsWith('!'))

  for (const dirs of getLayerDirectories(nuxt)) {
    entries.add(join(dirs.app, '**/*.{vue,js,jsx,mjs,ts,tsx,mts}'))
    // Scanning a layer's own dependency tree is unnecessary and slow. Vite globs patterns that contain
    // `node_modules` on their own, so for a local layer `node_module?` keeps this with the pattern above.
    entries.add('!' + join(dirs.app, '**/node_module?/**'))
    // Tests, server code, local modules and config files would pre-bundle packages the browser never
    // loads. Without an `app/` directory, the app directory is the layer root, which holds all of them.
    for (const pattern of ignore) {
      // a negation based above Vite's root (the `srcDir`) matches nothing
      entries.add('!' + join(pattern.startsWith('**/') ? dirs.app : dirs.root, pattern))
    }
    for (const dir of [dirs.server, dirs.modules, dirs.public]) {
      entries.add('!' + join(dir, '**'))
    }
    // config files such as `nuxt.config.ts` or `vitest.config.ts`
    entries.add('!' + join(dirs.root, '*.{js,jsx,mjs,ts,tsx,mts}'))
  }

  for (const app of Object.values(nuxt.apps)) {
    const files = [
      ...app.components.map(c => c.filePath),
      ...app.plugins.map(p => p.src),
      ...app.middleware.map(m => m.path),
      ...Object.values(app.layouts || {}).map(l => l.file),
    ]
    for (const file of files) {
      if (file.includes(NODE_MODULES)) {
        entries.add(file)
      }
    }
  }

  return [...entries]
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
