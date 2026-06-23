import type { Nuxt, NuxtBuilder } from '@nuxt/schema'
import { createIsIgnored, getLayerDirectories } from '@nuxt/kit'
import { normalize, resolve } from 'pathe'

/**
 * Reuse Vite's `server.watcher` (chokidar) to drive `builder:watch` instead of
 * spinning up a second FS watcher in Nuxt core. Only active in `dev` mode.
 */
export const setupWatcher: NonNullable<NuxtBuilder['setupWatcher']> = (nuxt: Nuxt) => {
  if (!nuxt.options.dev) { return }

  const isIgnored = createIsIgnored(nuxt)

  const extraPaths = new Set<string>()
  for (const layer of getLayerDirectories(nuxt)) {
    extraPaths.add(layer.app)
    if (!layer.server.startsWith(layer.app.replace(/\/?$/, '/'))) {
      extraPaths.add(layer.server)
    }
  }

  const srcDir = nuxt.options.srcDir.replace(/\/?$/, '/')
  for (const pattern of nuxt.options.watch) {
    if (typeof pattern !== 'string') { continue }
    const path = resolve(nuxt.options.srcDir, pattern)
    if (!path.startsWith(srcDir)) {
      extraPaths.add(path)
    }
  }

  nuxt.hook('vite:serverCreated', (server, { isClient }) => {
    // remove in nuxt v5
    if (!isClient) { return }

    const watcher = server.watcher

    watcher.on('all', (event, path) => {
      const normalized = normalize(path)
      if (isIgnored(normalized)) { return }
      nuxt.callHook('builder:watch', event, normalized)
    })

    if (extraPaths.size) {
      watcher.add([...extraPaths])
    }
  })
}
