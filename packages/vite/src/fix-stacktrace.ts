import type { NitroApp } from 'nitropack/types'
import type { ViteNodeRunner } from 'vite-node/client'

export default (nitroApp: NitroApp): void => {
  let runner: ViteNodeRunner
  nitroApp.hooks?.hook('error', async (error) => {
    if (!error?.stack) { return }
    const descriptor = Object.getOwnPropertyDescriptor(error, 'stack')
    if (descriptor && !descriptor.writable && !descriptor.set) { return }
    try {
      runner ||= await import('#internal/nuxt/vite-node-runner.mjs').then(m => m.default)
      await runner.ssrFixStacktrace(error)
    } catch {
      // best-effort only; preserve original error
    }
  })
}
