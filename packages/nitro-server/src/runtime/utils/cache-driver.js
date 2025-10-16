// @ts-check

import { defineDriver } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs-lite'
import lruCache from 'unstorage/drivers/lru-cache'

/**
 * @param {string} item
 */
const normalizeFsKey = item => decodeURIComponent(item.replaceAll(':', '_'))

/**
 * @param {{ base: string }} opts
 */
export default defineDriver((opts) => {
  const fs = fsDriver({ base: opts.base })
  const lru = lruCache({ max: 1000 })

  return {
    ...fs, // fall back to file system - only the bottom three methods are used in renderer
    async setItem (key, value, opts) {
      await Promise.all([
        fs.setItem?.(normalizeFsKey(key), value, opts),
        lru.setItem?.(key, value, opts),
      ])
    },
    async hasItem (key, opts) {
      return await lru.hasItem(key, opts) || await fs.hasItem(normalizeFsKey(key), opts)
    },
    async getItem (key, opts) {
      return await lru.getItem(key, opts) || await fs.getItem(normalizeFsKey(key), opts)
    },
  }
})
