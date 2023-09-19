import { parseNodeModulePath, resolvePath } from 'mlly'
import { isAbsolute, normalize } from 'pathe'
import type { Plugin } from 'vite'
import { logger, resolveAlias } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'

import { pkgDir } from '../../dirs'

export function resolveDeepImportsPlugin (nuxt: Nuxt): Plugin {
  const exclude: string[] = ['virtual:', '\0virtual:', '/__skip_vite']
  return {
    name: 'nuxt:resolve-bare-imports',
    enforce: 'post',
    async resolveId (id, importer, options) {
      if (!importer || isAbsolute(id) || !isAbsolute(importer) || exclude.some(e => id.startsWith(e))) {
        return
      }
      id = normalize(id)
      id = resolveAlias(id, nuxt.options.alias)
      const { dir } = parseNodeModulePath(importer)
      return await this.resolve?.(id, dir || pkgDir, { skipSelf: true }) ?? await resolvePath(id, {
        url: [dir || pkgDir, ...nuxt.options.modulesDir],
        // TODO: respect nitro runtime conditions
        conditions: options.ssr ? ['node', 'import', 'require'] : ['import', 'require']
      }).catch(() => {
        logger.log('Could not resolve id', id, importer)
        return null
      })
    }
  }
}
