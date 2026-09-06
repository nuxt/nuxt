import { pathToFileURL } from 'node:url'
import { resolve } from 'pathe'
import { setBuildOutput } from '@nuxt/kit'
import { useServerBuild } from '@nuxt/kit/internal'
import type { Nuxt } from '@nuxt/schema'
import type { Plugin } from 'vite'

export function ServerEntryPlugin (nuxt: Nuxt, entry: string): Plugin | undefined {
  if (useServerBuild(nuxt).buildsSeparately && nuxt.options.dev) {
    return
  }

  const serverEntryFile = resolve(nuxt.options.buildDir, 'dist/server/server.mjs')

  // A server builder whose build is not a pass of its own bundles the SSR app itself and
  // reaches the app entry through the renderer, so what it consumes is the entry this
  // build is given rather than a bundle on disk.
  //
  // Otherwise, re-export by absolute path (not file URL) so the nitro rollup build
  // inlines the entry and resolves its `#internal/*` imports at build time.
  const serverEntryCode = !useServerBuild(nuxt).buildsSeparately
    ? `export { default } from ${JSON.stringify(pathToFileURL(entry).href)}`
    : `export { default } from ${JSON.stringify(serverEntryFile)}`
  setBuildOutput('serverEntry', () => serverEntryCode)

  return {
    name: 'nuxt:server-entry',
    applyToEnvironment: env => env.name === 'ssr',
  }
}
