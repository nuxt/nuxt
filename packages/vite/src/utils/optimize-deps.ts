import { isAbsolute, join } from 'pathe'
import { resolveModulePath } from 'exsolve'
import { readPackageJSON } from 'pkg-types'
import { getLayerDirectories } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'

const NODE_MODULES = '/node_modules/'

/**
 * Scanner entries for app code that lives in `node_modules`, such as an installed layer
 * or a plugin a module registers from its own runtime directory.
 *
 * Vite does not pre-bundle a bare import whose importer is in `node_modules`, so without
 * these its dependencies are served raw, breaking if they are CJS-only.
 */
export function installedScanEntries (nuxt: Nuxt): string[] {
  const entries = new Set<string>()

  for (const dirs of getLayerDirectories(nuxt)) {
    if (dirs.app !== nuxt.options.srcDir && dirs.app.includes(NODE_MODULES)) {
      entries.add(join(dirs.app, '**/*.{vue,js,jsx,mjs,ts,tsx,mts}'))
      // scanning the layer's own dependency tree is unnecessary and slow
      entries.add('!' + join(dirs.app, '**/node_modules/**'))
    }
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
