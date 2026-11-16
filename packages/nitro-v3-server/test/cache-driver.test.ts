import { promises as fsp } from 'node:fs'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

  it('never exposes a partially written payload to concurrent readers', async () => {
    const oldValue = 'old-complete-payload'
    const newValue = 'new-complete-payload'

    const writer = cacheDriver({ base })
    await writer.setItem!('/_payload.json', oldValue, {})

    const originalWriteFile = fsp.writeFile
    let releaseWrite!: () => void
    const writeStalled = new Promise<void>((resolve) => { releaseWrite = resolve })
    let partialWritten!: () => void
    const partialOnDisk = new Promise<void>((resolve) => { partialWritten = resolve })

    // simulate a nonatomic write interrupted midway
    const spy = vi.spyOn(fsp, 'writeFile').mockImplementation(async (path, data, options) => {
      await originalWriteFile.call(fsp, path, String(data).slice(0, Math.floor(String(data).length / 2)), options as never)
      partialWritten()
      await writeStalled
      return originalWriteFile.call(fsp, path, data, options as never)
    })

    try {
      const write = writer.setItem!('/_payload.json', newValue, {})
      await Promise.race([partialOnDisk, write])

      const reader = cacheDriver({ base })
      const observed = await reader.getItem('/_payload.json', {})
      expect([oldValue, newValue, null]).toContain(observed)

      releaseWrite()
      await write
    } finally {
      releaseWrite()
      spy.mockRestore()
    }
  })
})
