import { performance } from 'node:perf_hooks'
import { createError } from 'h3'
import { ViteNodeRunner } from 'vite-node/client'
import { $fetch } from 'ohmyfetch'
import consola from 'consola'
import { getViteNodeOptions } from './vite-node-shared.mjs'

const viteNodeOptions = getViteNodeOptions()
const runner = createRunner()
let render

export default async (ssrContext) => {
  // Workaround for stub mode
  // https://github.com/nuxt/framework/pull/3983
  process.server = true

  // Invalidate cache for files changed since last rendering
  const invalidates = await $fetch('/invalidates', {
    baseURL: viteNodeOptions.baseURL
  })
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
    async fetchModule (id) {
      // TODO: fix in vite-node
      id = id.replace(/\/\//g, '/')
      return await $fetch('/module/' + encodeURI(id), {
        baseURL: viteNodeOptions.baseURL
      }).catch((err) => {
        const errorData = err?.data?.data
        if (!errorData) {
          throw err
        }
        try {
          const { message, stack } = formatViteError(errorData)
          throw createError({
            statusMessage: 'Vite Error',
            message,
            stack
          })
        } catch (err) {
          // This should not happen unless there is an internal error with formatViteError!
          consola.error('Error while formatting vite error:', errorData)
          throw createError({
            statusMessage: 'Vite Error',
            message: errorData.message || 'Vite Error',
            stack: 'Vite Error\nat [check console]'
          })
        }
      })
    }
  })
}

function formatViteError (errorData) {
  const errorCode = errorData.name || errorData.reasonCode || errorData.code
  const frame = errorData.frame || errorData.source || errorData.pluginCode

  const getLocId = (locObj = {}) => locObj.file || locObj.id || locObj.url || ''
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
    frame && `<br><pre>${frame.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre><br>`
  ].filter(Boolean).join(' ')

  const stack = [
    message,
    'at ' + loc,
    errorData.stack
  ].filter(Boolean).join('\n')

  return {
    message,
    stack
  }
}
