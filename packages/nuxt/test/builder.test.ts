import { writeFileSync } from 'node:fs'

import { join, relative, resolve } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import { describe, expect, it } from 'vitest'
import { build, loadNuxt } from 'nuxt'

describe('builder:watch', { sequential: true }, async () => {
  const workspaceDir = await findWorkspaceDir()
  const fixtureRoot = join(workspaceDir!, 'test/fixtures/basic')
  // Test relies on fixture structure: watch targets `other`, `../higher`, and `test` are created at runtime
  const watcherStrategies = ['chokidar', 'chokidar-granular', 'parcel'] as const
  it.each(watcherStrategies)('should restart Nuxt when a file is added with %s strategy', { timeout: 60_000 }, async (watcher) => {
    const rootDir = fixtureRoot
    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: {
        experimental: { watcher },
        dev: true,
        watch: ['test', join(rootDir, 'other'), resolve(rootDir, '../higher')],
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

    const watchPromise = new Promise(resolve => nuxt.hooks.hookOnce('builder:watch', resolve))
    writeFileSync(resolve(rootDir, '../higher'), 'something')
    writeFileSync(join(rootDir, 'test'), 'something')
    writeFileSync(join(rootDir, 'other'), 'something')
    await watchPromise

    await nuxt.close()

    expect.soft(restarts).toBe(3)
    expect.soft(events.sort()).toStrictEqual([
      '../higher',
      'other',
      'test',
    ])
  })
})
