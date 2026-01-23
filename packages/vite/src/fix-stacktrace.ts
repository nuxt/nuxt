import type { NitroApp } from 'nitropack/types'
import type { ViteNodeRunner } from 'vite-node/client'

export default (nitroApp: NitroApp) => {
  let runner: ViteNodeRunner
  nitroApp.hooks.hook('error', async (error) => {
    // @ts-expect-error post-build file
    runner ||= await import(/* @vite-ignore */'#build/dist/server/runner.mjs').then(m => m.default)
    if (error?.stack) {
      await runner.ssrFixStacktrace(error)
    }
  })
}
