import { parseNodeModulePath, resolvePath } from 'mlly'
import { isAbsolute } from 'pathe'
import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { pkgDir } from '../../dirs'

export function resolveDeepImportsPlugin (nuxt: Nuxt): Plugin {
  return {
    name: 'nuxt:resolve-bare-imports',
    enforce: 'post',
    async resolveId (id, importer, options) {
      if (!importer || isAbsolute(id) || !isAbsolute(importer) || id.startsWith('virtual:')) {
        return
      }
      const { dir } = parseNodeModulePath(importer)
      return await this.resolve?.(id, dir || pkgDir, { skipSelf: true }) ?? await resolvePath(id, {
        url: [dir || pkgDir, ...nuxt.options.modulesDir],
        conditions: options.ssr ? ['node', 'import', 'require'] : ['import', 'require']
      }).catch(() => {
        console.log('could not resolve id', id, importer)
        return null
      })
    }
  }
}
