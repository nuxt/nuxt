import { parseNodeModulePath } from 'mlly'
import { resolveModulePath } from 'exsolve'
import { isAbsolute, normalize, resolve } from 'pathe'
import type { Plugin } from 'vite'
import { directoryToURL, resolveAlias, tryImportModule } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { Nitro } from 'nitropack'

import type { PackageJson } from 'pkg-types'
import { pkgDir } from '../../dirs'
import { logger } from '../../utils'

const VIRTUAL_RE = /^\0?virtual:(?:nuxt:)?/

export function resolveDeepImportsPlugin (nuxt: Nuxt): Plugin {
  const exclude: string[] = ['virtual:', '\0virtual:', '/__skip_vite', '@vitest/']
  let conditions: string[]
  let external: Set<string>

  return {
    name: 'nuxt:resolve-bare-imports',
    enforce: 'post',
    async configResolved (config) {
      const resolvedConditions = new Set([nuxt.options.dev ? 'development' : 'production', ...config.resolve.conditions])
      if (resolvedConditions.has('browser')) {
        resolvedConditions.add('web')
        resolvedConditions.add('import')
        resolvedConditions.add('module')
        resolvedConditions.add('default')
      }
      if (config.mode === 'test') {
        resolvedConditions.add('import')
        resolvedConditions.add('require')
      }
      conditions = [...resolvedConditions]

      const runtimeDependencies = await tryImportModule<PackageJson>('nitropack/package.json', {
        url: new URL(import.meta.url),
      })?.then(r => r?.dependencies ? Object.keys(r.dependencies) : []).catch(() => []) || []

      external = new Set([
        // explicit dependencies we use in our ssr renderer - these can be inlined (if necessary) in the nitro build
        'unhead', '@unhead/vue', 'unctx', 'h3', 'devalue', '@nuxt/devalue', 'radix3', 'rou3', 'unstorage', 'hookable',
        // ensure we only have one version of vue if nitro is going to inline anyway
        ...((nuxt as any)._nitro as Nitro).options.inlineDynamicImports ? ['vue', '@vue/server-renderer', '@unhead/vue'] : [],
        // dependencies we might share with nitro - these can be inlined (if necessary) in the nitro build
        ...runtimeDependencies,
      ])
    },
    async resolveId (id, importer) {
      if (!importer || isAbsolute(id) || (!isAbsolute(importer) && !VIRTUAL_RE.test(importer)) || exclude.some(e => id.startsWith(e))) {
        return
      }

      const overrides = external.has(id) ? { external: 'absolute' } as const : {}

      const normalisedId = resolveAlias(normalize(id), nuxt.options.alias)
      const isNuxtTemplate = importer.startsWith('virtual:nuxt')
      const normalisedImporter = (isNuxtTemplate ? decodeURIComponent(importer) : importer).replace(VIRTUAL_RE, '')

      if (nuxt.options.experimental.templateImportResolution !== false && isNuxtTemplate) {
        const template = nuxt.options.build.templates.find(t => resolve(nuxt.options.buildDir, t.filename!) === normalisedImporter)
        if (template?._path) {
          const res = await this.resolve?.(normalisedId, template._path, { skipSelf: true })
          if (res !== undefined && res !== null) {
            return {
              ...res,
              ...overrides,
            }
          }
        }
      }

      const dir = parseNodeModulePath(normalisedImporter).dir || pkgDir

      const res = await this.resolve?.(normalisedId, dir, { skipSelf: true })
      if (res !== undefined && res !== null) {
        return {
          ...res,
          ...overrides,
        }
      }

      const path = resolveModulePath(id, {
        from: [dir, ...nuxt.options.modulesDir].map(d => directoryToURL(d)),
        suffixes: ['', 'index'],
        conditions,
        try: true,
      })

      if (!path) {
        logger.debug('Could not resolve id', id, importer)
        return null
      }

      if (external.has(id)) {
        return {
          id: normalize(path),
          external: 'absolute',
        }
      }

      return normalize(path)
    },
  }
}
