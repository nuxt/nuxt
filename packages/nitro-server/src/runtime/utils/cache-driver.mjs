// @ts-check

import crypto from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import fsDriver from 'unstorage/drivers/fs-lite'
import lruCache from 'unstorage/drivers/lru-cache'

/**
 * @param {string} item
 */
function normalizeFsKey (item) {
  const safe = item.replace(/[^\w.-]/g, '_')
  const prefix = safe.slice(0, 20)
  const hash = crypto.createHash('sha256').update(item).digest('hex')
  return `${prefix}-${hash}`
}

/**
 * @param {string} path
 * @param {string | Uint8Array} value
 */
async function writeAtomically (path, value) {
  const temporaryPath = `${path}.${crypto.randomUUID()}.tmp`
  await mkdir(dirname(path), { recursive: true })
  try {
    await writeFile(temporaryPath, value, 'utf8')
    await rename(temporaryPath, path)
  } catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}

/**
 * @param {{ base?: string, readOnly?: boolean }} options
 * @returns {import('unstorage').Driver} An unstorage driver that uses both LRU cache and file system, with LRU as the primary and file system as the fallback.
 */
export default function cacheDriver (options) {
  const fs = fsDriver({ base: options.base })
  const lru = lruCache({ max: 1000 })

  return {
    ...fs, // fall back to file system - only the bottom three methods are used in renderer
    async setItem (key, value, setOptions) {
      if (!options.readOnly) {
        await writeAtomically(join(options.base, normalizeFsKey(key)), value)
      }
      await lru.setItem?.(key, value, setOptions)
    },
    async hasItem (key, opts) {
      return await lru.hasItem(key, opts) || await fs.hasItem(normalizeFsKey(key), opts)
    },
    async getItem (key, opts) {
      return await lru.getItem(key, opts) || await fs.getItem(normalizeFsKey(key), opts)
    },
  }
}
