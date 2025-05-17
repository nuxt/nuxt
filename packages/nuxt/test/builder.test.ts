import { writeFileSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { join, relative } from 'node:path'

import { build, loadNuxt } from 'nuxt'
import { findWorkspaceDir } from 'pkg-types'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

describe('builder:watch', async () => {
  const tmpDir = join(await findWorkspaceDir(), '.test/builder-watch')
  beforeEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    await mkdir(tmpDir, { recursive: true })
  })
  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })
  const watcherStrategies = ['chokidar', 'chokidar-granular', 'parcel'] as const
  it.each(watcherStrategies)('should restart Nuxt when a file is added with %s strategy', async (watcher) => {
    const nuxt = await loadNuxt({
      cwd: tmpDir,
      ready: true,
      overrides: {
        experimental: { watcher },
        dev: true,
        watch: ['test', join(tmpDir, 'other')],
      },
    })
    let restarts = 0
    const events: string[] = []

    nuxt.hook('restart', () => { restarts++ })
    nuxt.hook('builder:watch', (event, path) => {
      if (event === 'add') {
        events.push(relative(tmpDir, path))
      }
    })

    await build(nuxt)

    const watchPromise = new Promise(resolve => nuxt.hooks.hookOnce('builder:watch', resolve))
    writeFileSync(join(tmpDir, 'test'), 'something')
    writeFileSync(join(tmpDir, 'other'), 'something')
    await watchPromise

    await nuxt.close()

    expect.soft(restarts).toBe(2)
    expect.soft(events.sort()).toStrictEqual(['other', 'test'])
  })
})
