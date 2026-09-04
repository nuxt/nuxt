import process from 'node:process'
import { viteNodeFetch } from '#vite-node'
import runner from '#vite-node-runner'

export default async function loadIslandComponents (): Promise<Record<string, unknown>> {
  // eslint-disable-next-line nuxt/prefer-import-meta,@typescript-eslint/no-deprecated
  process.server = true
  import.meta.server = true

  const invalidates = await viteNodeFetch.getInvalidates()
  runner.moduleCache.invalidateDepTree(invalidates)

  const mod = await runner.executeId('#build/components.islands.mjs')
  return mod
}
