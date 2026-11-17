import { realpathSync } from 'node:fs'
import { matchesGlob } from 'node:path'
import { isAbsolute, join, normalize, resolve } from 'pathe'
import { withTrailingSlash } from 'ufo'
import { createUnimport } from 'unimport'
import type { Import, Preset, Unimport } from 'unimport'
import type { Plugin } from 'rollup'
import type { Nitro, NitroConfig } from 'nitropack/types'

import { toArray } from './utils.ts'

const QUERY_RE = /\?.*$/
const SCRIPT_RE = /\.[cm]?[jt]sx?$/

/** Whether `id` matches an `imports.exclude` pattern, with globs resolved as unimport resolves them. */
function isExcluded (id: string, pattern: string | RegExp | null | undefined): boolean {
  if (typeof pattern === 'string') {
    return matchesGlob(id, isAbsolute(pattern) || pattern.startsWith('**') ? pattern : resolve(pattern))
  }
  return !!pattern?.test(id)
}

function toRealPath (path: string): string {
  try {
    return normalize(realpathSync.native(path))
  } catch {
    return normalize(path)
  }
}

/**
 * Whether a module id is in the `runtime` or `dist/runtime` directory of one of `moduleDirs`,
 * through the path as given or its real path.
 */
export function createModuleRuntimeFilter (moduleDirs: string[]): (id: string) => boolean {
  const prefixes = new Set<string>()
  for (const dir of moduleDirs) {
    for (const root of new Set([normalize(dir), toRealPath(dir)])) {
      prefixes.add(withTrailingSlash(join(root, 'runtime')))
      prefixes.add(withTrailingSlash(join(root, 'dist/runtime')))
    }
  }
  return (id) => {
    const path = normalize(id.replace(QUERY_RE, ''))
    for (const prefix of prefixes) {
      // a nested `node_modules` is a dependency of the module, not the module
      if (path.startsWith(prefix) && !path.slice(prefix.length).includes('node_modules/')) {
        return true
      }
    }
    return false
  }
}

/**
 * Keep the h3 and nitro auto-imports out of the server build, apart from module runtime code,
 * which keeps them both injected and imported from `#imports`.
 */
export async function setupModuleRuntimeImports (nitroConfig: NitroConfig, presets: Preset[], isModuleRuntime: (id: string) => boolean): Promise<void> {
  // nitropack appends its h3 and runtime presets while resolving options, before modules run
  const presetCount = (nitroConfig.imports && nitroConfig.imports.presets?.length) || 0
  let nitro: Nitro | undefined
  let unimport: Unimport | undefined
  let serverImports: Import[] | undefined

  nitroConfig.modules = [
    (_nitro) => {
      if (_nitro.options.imports) {
        nitro = _nitro
        unimport = createUnimport({
          presets: [...presets, ..._nitro.options.imports.presets.splice(presetCount)],
          virtualImports: ['#imports'],
          // the server auto-imports already report their own conflicts
          warn: () => {},
        })
      }
    },
    ...nitroConfig.modules || [],
  ]

  nitroConfig.rollupConfig ||= {}
  nitroConfig.rollupConfig.plugins = toArray(await nitroConfig.rollupConfig.plugins || [])
  nitroConfig.rollupConfig.plugins.push({
    name: 'nuxt:nitro-module-imports',
    async transform (code, id) {
      const options = nitro?.options.imports
      if (!unimport || !options || !nitro?.unimport || !SCRIPT_RE.test(id.replace(QUERY_RE, '')) || !isModuleRuntime(id)) {
        return
      }
      const autoImport = options.autoImport !== false && ![options.exclude].flat().some(pattern => isExcluded(id, pattern))
      if (!autoImport && !code.includes('#imports')) {
        return
      }
      const imports = await nitro.unimport.getImports()
      if (imports !== serverImports) {
        serverImports = imports
        await unimport.modifyDynamicImports(() => imports)
      }
      const { s } = await unimport.injectImports(code, id, { autoImport })
      if (s.hasChanged()) {
        return { code: s.toString(), map: s.generateMap({ hires: true }) }
      }
    },
  } satisfies Plugin)
}
