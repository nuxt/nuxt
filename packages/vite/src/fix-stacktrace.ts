import type { NitroApp } from 'nitro/types'
import type { ViteNodeRunner } from 'vite-node/client'

export default (nitroApp: NitroApp): void => {
  let runner: ViteNodeRunner
  nitroApp.hooks?.hook('error', async (error) => {
    if (!error?.stack) { return }
    try {
      // @ts-expect-error virtual alias registered by vite builder
      runner ||= await import('#internal/nuxt/vite-node-runner').then(m => m.default)
      runner.ssrFixStacktrace(error)
    } catch {
      // best-effort only; preserve original error
    }
  })
}
