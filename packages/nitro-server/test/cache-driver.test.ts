import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import cacheDriver from '../src/runtime/utils/cache-driver.mjs'

describe('cache-driver', () => {
  let base: string

  beforeEach(async () => {
    base = await mkdtemp(join(tmpdir(), 'nuxt-cache-driver-'))
  })

  afterEach(async () => {
    await rm(base, { recursive: true, force: true })
  })

  it('falls back to the on-disk store when the entry is not in the LRU', async () => {
    const writer = cacheDriver({ base })
    await writer.setItem!('/_payload.json', 'payload', {})

    const reader = cacheDriver({ base })
    expect(await reader.hasItem('/_payload.json', {})).toBe(true)
    expect(await reader.getItem('/_payload.json', {})).toBe('payload')
  })

  it('leaves no temporary files behind after writing', async () => {
    const driver = cacheDriver({ base })
    await driver.setItem!('/_payload.json', 'payload', {})
    await driver.setItem!('/_payload.json', 'updated', {})

    const files = await readdir(base)
    expect(files.some(file => file.endsWith('.tmp'))).toBe(false)
    expect(files).toHaveLength(1)

    const reader = cacheDriver({ base })
    expect(await reader.getItem('/_payload.json', {})).toBe('updated')
  })
})
