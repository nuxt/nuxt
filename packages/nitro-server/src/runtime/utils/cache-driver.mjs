// @ts-check

import crypto from 'node:crypto'
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
 * @param {{ base?: string }} opts
 * @returns {import('unstorage').Driver} An unstorage driver that uses both LRU cache and file system, with LRU as the primary and file system as the fallback.
 */
export default function cacheDriver (opts) {
  const fs = fsDriver({ base: opts.base })
  const lru = lruCache({ max: 1000 })

  return {
    ...fs, // fall back to file system - only the bottom three methods are used in renderer
    async setItem (key, value, opts) {
      await fs.setItem?.(normalizeFsKey(key), value, opts)
      await lru.setItem?.(key, value, opts)
    },
    async hasItem (key, opts) {
      return await lru.hasItem(key, opts) || await fs.hasItem(normalizeFsKey(key), opts)
    },
    async getItem (key, opts) {
      return await lru.getItem(key, opts) || await fs.getItem(normalizeFsKey(key), opts)
    },
  }
}
