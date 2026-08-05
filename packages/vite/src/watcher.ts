import { existsSync, statSync } from 'node:fs'
import type { Nuxt, NuxtBuilder } from '@nuxt/schema'
import { createIsIgnored, getLayerDirectories } from '@nuxt/kit'
import { normalize, resolve } from 'pathe'

/**
 * chokidar registers paths passed to `add()` asynchronously and, because vite
 * watches with `ignoreInitial`, a path created while that registration is still
 * in flight is never reported. Re-check the paths that did not exist when they
 * were added, for as long as a dev server realistically takes to settle.
 */
const RECONCILE_DELAYS = [100, 300, 1000]

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
      const missing = new Set([...extraPaths].filter(path => !existsSync(path)))
      watcher.add([...extraPaths])

      watcher.on('all', (_event, path) => missing.delete(normalize(path)))

      for (const delay of RECONCILE_DELAYS) {
        const timeout = setTimeout(() => {
          for (const path of missing) {
            let stats
            try {
              stats = statSync(path, { throwIfNoEntry: false })
            } catch {
              // best-effort: an unreadable path is left for a later delay
            }
            if (!stats) { continue }
            missing.delete(path)
            const event = stats.isDirectory() ? 'addDir' : 'add'
            watcher.emit(event, path)
            watcher.emit('all', event, path)
          }
        }, delay)
        timeout.unref()
      }
    }
  })
}
