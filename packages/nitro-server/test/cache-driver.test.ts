import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import cacheDriver from '../src/runtime/utils/cache-driver.mjs'

describe('prerender cache driver', () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
  })

  it('reads an atomically persisted value after it has been evicted from the LRU', async () => {
    const base = await mkdtemp(join(tmpdir(), 'nuxt-prerender-cache-'))
    temporaryDirectories.push(base)
    const cache = cacheDriver({ base })

    await cache.setItem('payload:page', 'first value')
    await cache.setItem('payload:page', 'updated value')
    for (let index = 0; index < 1000; index++) {
      await cache.setItem(`payload:filler-${index}`, String(index))
    }

    expect(await cache.getItem('payload:page')).toBe('updated value')
    expect(await readdir(base)).toHaveLength(1001)
    expect((await readdir(base)).some(name => name.endsWith('.tmp'))).toBe(false)
  })
})
