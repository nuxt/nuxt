import { resolve } from 'pathe'
import { pathToFileURL } from 'node:url'
import { setBuildOutput } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { Plugin } from 'vite'

export function ServerEntryPlugin (nuxt: Nuxt, entry: string): Plugin | undefined {
  if (!nuxt.options.experimental.nitroViteEnvironment && nuxt.options.dev) {
    return
  }

  const serverEntryFile = resolve(nuxt.options.buildDir, 'dist/server/server.mjs')
  const appEntryFile = pathToFileURL(entry).href

  const serverEntryCode = nuxt.options.experimental.nitroViteEnvironment
    ? `export { default } from ${JSON.stringify(appEntryFile)}`
    : `export { default } from ${JSON.stringify(pathToFileURL(serverEntryFile).href)}`
  setBuildOutput('serverEntry', () => serverEntryCode)

  return {
    name: 'nuxt:server-entry',
    applyToEnvironment: env => env.name === 'ssr',
  }
}
