import { createRequire } from 'node:module'
import { createUnplugin } from 'unplugin'
import { logger } from '@nuxt/kit'
import { isAbsolute, join, relative, resolve } from 'pathe'
import escapeRE from 'escape-string-regexp'
import type { NuxtOptions } from 'nuxt/schema'

const _require = createRequire(import.meta.url)

interface ImportProtectionOptions {
  rootDir: string
  patterns: [importPattern: string | RegExp, warning?: string][]
  exclude?: Array<RegExp | string>
}

export const nuxtImportProtections = (nuxt: { options: NuxtOptions }, options: { isNitro?: boolean } = {}) => {
  const patterns: ImportProtectionOptions['patterns'] = []

  patterns.push([
    /^(nuxt|nuxt3|nuxt-nightly)$/,
    '`nuxt`, `nuxt3` or `nuxt-nightly` cannot be imported directly.' + (options.isNitro ? '' : ' Instead, import runtime Nuxt composables from `#app` or `#imports`.')
  ])

  patterns.push([
    /^((|~|~~|@|@@)\/)?nuxt\.config(\.|$)/,
    'Importing directly from a `nuxt.config` file is not allowed. Instead, use runtime config or a module.'
  ])

  patterns.push([/(^|node_modules\/)@vue\/composition-api/])

  for (const mod of nuxt.options.modules.filter(m => typeof m === 'string')) {
    patterns.push([
      new RegExp(`^${escapeRE(mod as string)}$`),
      'Importing directly from module entry-points is not allowed.'
    ])
  }

  for (const i of [/(^|node_modules\/)@nuxt\/(kit|test-utils)/, /(^|node_modules\/)nuxi/, /(^|node_modules\/)nuxt\/(config|kit|schema)/, 'nitropack']) {
    patterns.push([i, 'This module cannot be imported' + (options.isNitro ? 'in server runtime.' : ' in the Vue part of your app.')])
  }

  if (options.isNitro) {
    for (const i of ['#app', /^#build(\/|$)/]) {
      patterns.push([i, 'Vue app aliases are not allowed in server runtime.'])
    }
  }

  if (!options.isNitro) {
    patterns.push([
      new RegExp(escapeRE(relative(nuxt.options.srcDir, resolve(nuxt.options.srcDir, nuxt.options.serverDir || 'server'))) + '\\/(api|routes|middleware|plugins)\\/'),
      'Importing from server is not allowed in the Vue part of your app.'
    ])
  }

  return patterns
}

export const ImportProtectionPlugin = createUnplugin(function (options: ImportProtectionOptions) {
  const cache: Record<string, Map<string | RegExp, boolean>> = {}
  const importersToExclude = options?.exclude || []
  return {
    name: 'nuxt:import-protection',
    enforce: 'pre',
    resolveId (id, importer) {
      if (!importer) { return }
      if (id[0] === '.') {
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
