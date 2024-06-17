import path from 'path'
import mkdirp from 'mkdirp'
import { createFsFromVolume, Volume } from 'memfs'
import { dirname } from 'upath'

const syncRegex = /Sync$/

export default function createFS () {
  const volume = new Volume()
  const fs = createFsFromVolume(volume)

  fs.join = path.join.bind(path)
  fs.mkdirp = mkdirp.bind(mkdirp)

  const propsToPromisify = Object.getOwnPropertyNames(fs).filter(n => syncRegex.test(n))

  const writeFileSync = fs.writeFileSync

  function ensureDirSync (...args) {
    if (typeof args[0] === 'string') {
      const dir = dirname(args[0])
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  fs.writeFileSync = function (...args) {
    ensureDirSync(...args)
    return writeFileSync.call(fs, ...args)
  }

  for (const prop of propsToPromisify) {
    const asyncProp = prop.replace(syncRegex, '')
    const origAsync = fs[asyncProp]

    fs[asyncProp] = function (...args) {
      if (asyncProp === 'writeFile') {
        ensureDirSync(...args)
      }

      // Callback support for webpack
      if (origAsync && args.length && typeof args[args.length - 1] === 'function') {
        return origAsync.call(fs, ...args)
      }

      try {
        return Promise.resolve(fs[prop](...args))
      } catch (error) {
        return Promise.reject(error)
      }
    }
  }

  return fs
}
