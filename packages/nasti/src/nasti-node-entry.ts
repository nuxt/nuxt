import process from 'node:process'
import { performance } from 'node:perf_hooks'
import { consola } from 'consola'
import { nastiNodeFetch, nastiNodeOptions } from '#nasti-node'
import runner from '#nasti-node-runner'

// SSR render entry executed inside Nitro (registered as `#build/dist/server/server.mjs`).
// Mirrors `@nuxt/vite-builder`'s `vite-node-entry`: invalidate changed modules, then run
// the server entry through the runner and call its default render export.

type SSRContext = Record<string, any>

let render: ((ssrContext: SSRContext) => Promise<unknown>) | undefined

export default async (ssrContext: SSRContext): Promise<unknown> => {
  // Flag the SSR runtime (some libraries branch on these).

  ;(process as any).server = true
  ;(import.meta as any).server = true

  // Invalidate modules changed since the previous render.
  const invalidates = await nastiNodeFetch.getInvalidates()
  const updates = runner.invalidate(invalidates)

  const start = performance.now()
  if (updates.has(nastiNodeOptions.entryPath) || !render) {
    const mod = await runner.executeFile(nastiNodeOptions.entryPath)
    render = mod.default as typeof render
  }
  if (updates.size) {
    const time = Math.round((performance.now() - start) * 1000) / 1000
    consola.success(`Nasti server hmr ${updates.size} files`, time ? `in ${time}ms` : '')
  }

  if (!render) {
    throw new Error('[nasti-builder] SSR entry did not export a render function.')
  }
  return render(ssrContext)
}
