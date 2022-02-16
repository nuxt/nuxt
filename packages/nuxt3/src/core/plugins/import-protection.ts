import { createRequire } from 'module'
import { createUnplugin } from 'unplugin'
import { logger } from '@nuxt/kit'
import { isAbsolute, relative, resolve } from 'pathe'
import type { Nuxt } from '@nuxt/schema'
import escapeRE from 'escape-string-regexp'

const _require = createRequire(import.meta.url)

interface ImportProtectionOptions {
  rootDir: string
  patterns: [importPattern: string | RegExp, warning?: string][]
}

export const vueAppPatterns = (nuxt: Nuxt) => [
  [/^(nuxt3|nuxt)/, '`nuxt3`/`nuxt` cannot be imported directly. Instead, import runtime Nuxt composables from `#app` or `#imports`.'],
  [/nuxt\.config/, 'Importing directly from a `nuxt.config` file is not allowed. Instead, use runtime config or a module.'],
  [/(^|node_modules\/)@vue\/composition-api/],
  ...nuxt.options.modules.filter(m => typeof m === 'string').map((m: string) =>
    [new RegExp(`^${escapeRE(m)}$`), 'Importing directly from module entrypoints is not allowed.']),
  ...['#static-assets', '#static', '#config', '#assets', '#storage', '#server-middleware']
    .map(i => [i, 'Nitro aliases cannot be imported in the Vue part of your app.']),
  ...[/(^|node_modules\/)@nuxt\/kit/, /^@nuxt\/nitro/]
    .map(i => [i, 'This module cannot be imported in the Vue part of your app.']),
  [new RegExp(escapeRE(resolve(nuxt.options.srcDir, (nuxt.options.dir as any).server || 'server'))), 'Importing from server middleware is not allowed in the Vue part of your app.']
] as ImportProtectionOptions['patterns']

export const ImportProtectionPlugin = createUnplugin(function (options: ImportProtectionOptions) {
  const cache: Record<string, Map<string | RegExp, boolean>> = {}
  return {
    name: 'nuxt:import-protection',
    enforce: 'pre',
    resolveId (id, importer) {
      const invalidImports = options.patterns.filter(([pattern]) => pattern instanceof RegExp ? pattern.test(id) : pattern === id)
      let matched: boolean
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
