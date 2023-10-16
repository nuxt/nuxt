import { createRequire } from 'node:module'
import { createUnplugin } from 'unplugin'
import { logger } from '@nuxt/kit'
import { isAbsolute, join, relative } from 'pathe'
import escapeRE from 'escape-string-regexp'
import type { Nuxt } from 'nuxt/schema'

const _require = createRequire(import.meta.url)

interface ImportProtectionOptions {
  rootDir: string
  patterns: [importPattern: string | RegExp, warning?: string][]
  exclude?: Array<RegExp | string>
}

export const vueAppPatterns = (nuxt: Nuxt) => [
  [/^(nuxt|nuxt3|nuxt-nightly)$/, '`nuxt`/`nuxt3`/`nuxt-nightly` cannot be imported directly. Instead, import runtime Nuxt composables from `#app` or `#imports`.'],
  [/^((|~|~~|@|@@)\/)?nuxt\.config(\.|$)/, 'Importing directly from a `nuxt.config` file is not allowed. Instead, use runtime config or a module.'],
  [/(^|node_modules\/)@vue\/composition-api/],
  ...nuxt.options.modules.filter(m => typeof m === 'string').map((m: any) =>
    [new RegExp(`^${escapeRE(m as string)}$`), 'Importing directly from module entry points is not allowed.']),
  ...[/(^|node_modules\/)@nuxt\/kit/, /(^|node_modules\/)nuxt\/(config|kit|schema)/, /^nitropack/]
    .map(i => [i, 'This module cannot be imported in the Vue part of your app.']),
  [new RegExp(escapeRE(join(nuxt.options.srcDir, (nuxt.options.dir as any).server || 'server')) + '\\/(api|routes|middleware|plugins)\\/'), 'Importing from server is not allowed in the Vue part of your app.']
] as ImportProtectionOptions['patterns']

export const ImportProtectionPlugin = createUnplugin(function (options: ImportProtectionOptions) {
  const cache: Record<string, Map<string | RegExp, boolean>> = {}
  const importersToExclude = options?.exclude || []
  return {
    name: 'nuxt:import-protection',
    enforce: 'pre',
    resolveId (id, importer) {
      if (!importer) { return }
      if (id.startsWith('.')) {
        id = join(importer, '..', id)
      }
      if (isAbsolute(id)) {
        id = relative(options.rootDir, id)
      }
      if (importersToExclude.some(p => typeof p === 'string' ? importer === p : p.test(importer))) { return }

      const invalidImports = options.patterns.filter(([pattern]) => pattern instanceof RegExp ? pattern.test(id) : pattern === id)
      let matched = false
      for (const match of invalidImports) {
        cache[id] = cache[id] || new Map()
        const [pattern, warning] = match
        // Skip if already warned
        if (cache[id].has(pattern)) { continue }

        const relativeImporter = isAbsolute(importer) ? relative(options.rootDir, importer) : importer
        logger.error(warning || 'Invalid import', `[importing \`${id}\` from \`${relativeImporter}\`]`)
        cache[id].set(pattern, true)
        matched = true
      }
      if (matched) {
        return _require.resolve('unenv/runtime/mock/proxy')
      }
      return null
    }
  }
})
