// @ts-check

import { performance } from 'node:perf_hooks'
import { createError } from 'h3'
import { ViteNodeRunner } from 'vite-node/client'
import { consola } from 'consola'
import { viteNodeFetch, viteNodeOptions } from './vite-node-shared.mjs'

const runner = createRunner()

/** @type {(ssrContext: import('#app').NuxtSSRContext) => Promise<any>} */
let render

/** @param {import('#app').NuxtSSRContext} ssrContext */
export default async (ssrContext) => {
  // Workaround for stub mode
  // https://github.com/nuxt/framework/pull/3983
  // eslint-disable-next-line nuxt/prefer-import-meta
  process.server = true
  import.meta.server = true

  // Invalidate cache for files changed since last rendering
  const invalidates = await viteNodeFetch('/invalidates')
  const updates = runner.moduleCache.invalidateDepTree(invalidates)

  // Execute SSR bundle on demand
  const start = performance.now()
  render = (updates.has(viteNodeOptions.entryPath) || !render) ? (await runner.executeFile(viteNodeOptions.entryPath)).default : render
  if (updates.size) {
    const time = Math.round((performance.now() - start) * 1000) / 1000
    consola.success(`Vite server hmr ${updates.size} files`, time ? `in ${time}ms` : '')
  }

  const result = await render(ssrContext)
  return result
}

function createRunner () {
  return new ViteNodeRunner({
    root: viteNodeOptions.root, // Equals to Nuxt `srcDir`
    base: viteNodeOptions.base,
    async resolveId (id, importer) {
      return await viteNodeFetch('/resolve/' + encodeURIComponent(id) + (importer ? '?importer=' + encodeURIComponent(importer) : '')) ?? undefined
    },
    async fetchModule (id) {
      id = id.replace(/\/\//g, '/') // TODO: fix in vite-node
      return await viteNodeFetch('/module/' + encodeURI(id)).catch((err) => {
        const errorData = err?.data?.data
        if (!errorData) {
          throw err
        }
        let _err
        try {
          const { message, stack } = formatViteError(errorData, id)
          _err = createError({
            statusMessage: 'Vite Error',
            message,
            stack,
          })
        } catch (formatError) {
          consola.warn('Internal nuxt error while formatting vite-node error. Please report this!', formatError)
          const message = `[vite-node] [TransformError] ${errorData?.message || '-'}`
          consola.error(message, errorData)
          throw createError({
            statusMessage: 'Vite Error',
            message,
            stack: `${message}\nat ${id}\n` + (errorData?.stack || ''),
          })
        }
        throw _err
      })
    },
  })
}

/**
 * @param {any} errorData
 * @param {string} id
 */
function formatViteError (errorData, id) {
  const errorCode = errorData.name || errorData.reasonCode || errorData.code
  const frame = errorData.frame || errorData.source || errorData.pluginCode

  /** @param {{ file?: string, id?: string, url?: string }} locObj */
  const getLocId = (locObj = {}) => locObj.file || locObj.id || locObj.url || id || ''
  /** @param {{ line?: string, column?: string }} locObj */
  const getLocPos = (locObj = {}) => locObj.line ? `${locObj.line}:${locObj.column || 0}` : ''
  const locId = getLocId(errorData.loc) || getLocId(errorData.location) || getLocId(errorData.input) || getLocId(errorData)
  const locPos = getLocPos(errorData.loc) || getLocPos(errorData.location) || getLocPos(errorData.input) || getLocPos(errorData)
  const loc = locId.replace(process.cwd(), '.') + (locPos ? `:${locPos}` : '')

  const message = [
    '[vite-node]',
    errorData.plugin && `[plugin:${errorData.plugin}]`,
    errorCode && `[${errorCode}]`,
    loc,
    errorData.reason && `: ${errorData.reason}`,
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
