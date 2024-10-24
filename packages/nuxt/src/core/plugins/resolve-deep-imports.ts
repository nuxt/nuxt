import { parseNodeModulePath, resolvePath } from 'mlly'
import { isAbsolute, normalize } from 'pathe'
import type { Plugin } from 'vite'
import { logger, resolveAlias } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'

import { pkgDir } from '../../dirs'

export function resolveDeepImportsPlugin (nuxt: Nuxt): Plugin {
  const exclude: string[] = ['virtual:', '\0virtual:', '/__skip_vite']
  let conditions: string[]
  return {
    name: 'nuxt:resolve-bare-imports',
    enforce: 'post',
    configResolved (config) {
      conditions = config.mode === 'test' ? [...config.resolve.conditions, 'import', 'require'] : config.resolve.conditions
    },
    async resolveId (id, importer) {
      if (!importer || isAbsolute(id) || (!isAbsolute(importer) && !importer.startsWith('virtual:') && !importer.startsWith('\0virtual:')) || exclude.some(e => id.startsWith(e))) {
        return
      }

      const normalisedId = resolveAlias(normalize(id), nuxt.options.alias)
      const normalisedImporter = importer.replace(/^\0?virtual:(?:nuxt:)?/, '')
      const dir = parseNodeModulePath(normalisedImporter).dir || pkgDir

      return await this.resolve?.(normalisedId, dir, { skipSelf: true }) ?? await resolvePath(id, {
        url: [dir, ...nuxt.options.modulesDir],
        conditions,
      }).catch(() => {
        logger.debug('Could not resolve id', id, importer)
        return null
      })
    },
  }
}
