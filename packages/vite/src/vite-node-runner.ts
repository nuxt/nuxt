import { ViteNodeRunner } from 'vite-node/client'

import { consola } from 'consola'
import { viteNodeFetch, viteNodeOptions } from '#vite-node'
import process from 'node:process'
import type { ErrorPartial } from './types'

const runner: ViteNodeRunner = createRunner()

function createRunner () {
  return new ViteNodeRunner({
    root: viteNodeOptions.root, // Equals to Nuxt `srcDir`
    base: viteNodeOptions.base,
    resolveId (id, importer) {
      return viteNodeFetch.resolveId(id, importer)
    },
    fetchModule (id) {
      id = id.replace(/\/\//g, '/') // TODO: fix in vite-node
      return viteNodeFetch.fetchModule(id).catch((err) => {
        const errorData = err?.data?.data
        if (!errorData) {
          throw err
        }
        let _err
        try {
          const { message, stack } = formatViteError(errorData, id)
          _err = {
            statusText: 'Vite Error',
            message,
            stack,
          } satisfies ErrorPartial
        } catch (formatError) {
          consola.warn('Internal nuxt error while formatting vite-node error. Please report this!', formatError)
          const message = `[vite-node] [TransformError] ${errorData?.message || '-'}`
          consola.error(message, errorData)
          throw {
            statusText: 'Vite Error',
            message,
            stack: `${message}\nat ${id}\n` + (errorData?.stack || ''),
          } satisfies ErrorPartial
        }
        throw _err
      })
    },
  })
}

export function formatViteError (errorData: any, id: string) {
  const errorCode = errorData.name || errorData.reasonCode || errorData.code
  const frame = errorData.frame || errorData.source || errorData.pluginCode
  const detail = errorData.reason || errorData.message

  const getLocId = (locObj: { file?: string, id?: string, url?: string } = {}) => {
    const locId = locObj.file || locObj.id || locObj.url
    if (typeof locId === 'string' && locId && locId !== 'undefined') {
      return locId
    }
    return id || ''
  }
  const getLocPos = (locObj: { line?: string | number, column?: string | number } = {}) => {
    const line = locObj.line
    if (line === undefined || line === null || line === '' || line === 'undefined') {
      return ''
    }
    const column = locObj.column
    const safeColumn = (column === undefined || column === null || column === '' || column === 'undefined') ? 0 : column
    return `${line}:${safeColumn}`
  }
  const locId = getLocId(errorData.loc) || getLocId(errorData.location) || getLocId(errorData.input) || getLocId(errorData)
  const locPos = getLocPos(errorData.loc) || getLocPos(errorData.location) || getLocPos(errorData.input) || getLocPos(errorData)
  const rawLoc = locId.replace(process.cwd(), '.') + (locPos ? `:${locPos}` : '')
  const loc = rawLoc.includes('undefined:undefined') ? locId.replace(process.cwd(), '.') : rawLoc

  const message = [
    '[vite-node]',
    errorData.plugin && `[plugin:${errorData.plugin}]`,
    errorCode && `[${errorCode}]`,
    loc,
    detail && `: ${detail}`,
    frame && `<br><pre>${frame.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre><br>`,
  ].filter(Boolean).join(' ')

  const stack = [
    message,
    `at ${loc}`,
    errorData.stack,
  ].filter(Boolean).join('\n')

  return {
    message,
    stack,
  }
}

export default runner
