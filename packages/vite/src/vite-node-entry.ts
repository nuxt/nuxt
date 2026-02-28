import process from 'node:process'
import { performance } from 'node:perf_hooks'
import { consola } from 'consola'
import { viteNodeFetch, viteNodeOptions } from '#vite-node'
import type { NuxtSSRContext } from 'nuxt/app'
import runner from '#vite-node-runner'

let render: (ssrContext: NuxtSSRContext) => Promise<any>

export default async (ssrContext: NuxtSSRContext): Promise<any> => {
  // Workaround for stub mode
  // https://github.com/nuxt/framework/pull/3983
  // eslint-disable-next-line nuxt/prefer-import-meta,@typescript-eslint/no-deprecated
  process.server = true
  import.meta.server = true

  // Invalidate cache for files changed since last rendering
  const invalidates = await viteNodeFetch.getInvalidates()
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
