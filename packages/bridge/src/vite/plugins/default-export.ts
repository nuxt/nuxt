import type { Plugin } from 'vite'
import fse from 'fs-extra'

// const PREFIX = 'defaultexport:'
const PREFIX = 'defaultexport:'
const hasPrefix = (id: string = '') => id.startsWith(PREFIX)
const removePrefix = (id: string = '') => hasPrefix(id) ? id.substr(PREFIX.length) : id

const hasDefaultExport = (code: string = '') => code.includes('export default')
const addDefaultExport = (code: string = '') => code + '\n\n' + 'export default () => {}'

export function defaultExportPlugin () {
  return <Plugin>{
    name: 'nuxt:default-export',
    enforce: 'pre',
    resolveId (id, importer) {
      if (hasPrefix(id)) {
        return id
      }
      if (importer && hasPrefix(importer)) {
        return this.resolve(id, removePrefix(importer))
      }
      return null
    },

    async load (id) {
      if (hasPrefix(id)) {
        let code = await fse.readFile(removePrefix(id), 'utf8')
        if (!hasDefaultExport(code)) {
          code = addDefaultExport(code)
        }
        return { map: null, code }
      }
      return null
    }
  }
}
