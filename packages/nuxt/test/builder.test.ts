import { writeFileSync } from 'node:fs'

import { join, relative, resolve } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import { describe, expect, it } from 'vitest'
import { build, loadNuxt } from 'nuxt'

describe('builder:watch', { sequential: true }, async () => {
  const workspaceDir = await findWorkspaceDir()
  const fixtureRoot = join(workspaceDir!, 'test/fixtures/basic')
  const watcherStrategies = ['chokidar', 'chokidar-granular', 'parcel'] as const
  it.each(watcherStrategies)('should restart Nuxt when a file is added with %s strategy', { timeout: 120_000 }, async (watcher) => {
    const rootDir = fixtureRoot
    // Unique paths per run so we get 'add' events (reused paths would emit 'change')
    const uniqueId = `${watcher}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const watchTargets = {
      inRoot: `test-${uniqueId}`,
      other: join(rootDir, `other-${uniqueId}`),
      higher: resolve(rootDir, `../higher-${uniqueId}`),
    }
    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: {
        experimental: { watcher },
        dev: true,
        watch: [watchTargets.inRoot, watchTargets.other, watchTargets.higher],
      },
    })
    let restarts = 0
    const events: string[] = []

    nuxt.hook('restart', () => { restarts++ })
    nuxt.hook('builder:watch', (event, path) => {
      if (event === 'add') {
        events.push(relative(rootDir, path))
      }
    })

    await build(nuxt)

    // Allow watcher to stabilize before writing files (chokidar/parcel need time after ready)
    await new Promise(r => setTimeout(r, 100))

    writeFileSync(watchTargets.higher, 'something')
    writeFileSync(join(rootDir, watchTargets.inRoot), 'something')
    writeFileSync(watchTargets.other, 'something')

    // Wait for all three file events before closing (hookOnce would only wait for the first)
    const deadline = Date.now() + 5000
    while (events.length < 3 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 50))
    }

    await nuxt.close()

    const expectedPaths = [
      `../higher-${uniqueId}`,
      `other-${uniqueId}`,
      watchTargets.inRoot,
    ].sort()
    expect.soft(restarts).toBe(3)
    expect.soft(events.sort()).toStrictEqual(expectedPaths)
  })
})
