import { parseNodeModulePath } from 'mlly'
import { resolveModulePath } from 'exsolve'
import { isAbsolute, normalize } from 'pathe'
import type { Plugin } from 'vite'
import { directoryToURL, resolveAlias } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'

import { pkgDir } from '../../dirs'
import { logger } from '../../utils'

export function resolveDeepImportsPlugin (nuxt: Nuxt): Plugin {
  const exclude: string[] = ['virtual:', '\0virtual:', '/__skip_vite', '@vitest/']
  let conditions: string[]
  return {
    name: 'nuxt:resolve-bare-imports',
    enforce: 'post',
    configResolved (config) {
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
    },
    async resolveId (id, importer) {
      if (!importer || isAbsolute(id) || (!isAbsolute(importer) && !importer.startsWith('virtual:') && !importer.startsWith('\0virtual:')) || exclude.some(e => id.startsWith(e))) {
        return
      }

      const normalisedId = resolveAlias(normalize(id), nuxt.options.alias)
      const normalisedImporter = importer.replace(/^\0?virtual:(?:nuxt:)?/, '')
      const dir = parseNodeModulePath(normalisedImporter).dir || pkgDir

      const res = await this.resolve?.(normalisedId, dir, { skipSelf: true })
      if (res !== undefined && res !== null) {
        return res
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

      return path
    },
  }
}
