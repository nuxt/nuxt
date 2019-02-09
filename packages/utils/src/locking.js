import path from 'path'
import consola from 'consola'
import hash from 'hash-sum'
import fs from 'fs-extra'
import properlock from 'proper-lockfile'
import onExit from 'signal-exit'

export const lockPaths = new Set()

export const defaultLockOptions = {
  stale: 15000,
  onCompromised: err => consola.fatal(err)
}

export function getLockOptions(options) {
  return Object.assign({}, defaultLockOptions, options)
}

export function createLockPath({ id = 'nuxt', dir, root }) {
  const sum = hash(`${root}-${dir}`)

  return path.resolve(root, 'node_modules/.cache/nuxt', `${id}-lock-${sum}`)
}

export async function getLockPath(config) {
  const lockPath = createLockPath(config)

  // the lock is created for the lockPath as ${lockPath}.lock
  // so the (temporary) lockPath needs to exist
  await fs.ensureDir(lockPath)

  return lockPath
}

export async function lock({ id, dir, root, options }) {
  const lockPath = await getLockPath({ id, dir, root })

  const locked = await properlock.check(lockPath)
  if (locked) {
    consola.fatal(`A lock with id '${id}' already exists on ${dir}`)
  }

  const release = await properlock.lock(lockPath, options)

  if (!release) {
    consola.warn(`Unable to get a lock with id '${id}' on ${dir} (but will continue)`)
  }

  if (!lockPaths.size) {
    // make sure to always cleanup our temporate lockPaths
    onExit(() => {
      for (const lockPath of lockPaths) {
        fs.removeSync(lockPath)
      }
    })
  }

  lockPaths.add(lockPath)

  return async function lockRelease() {
    await release()
    await fs.remove(lockPath)
    lockPaths.delete(lockPath)
  }
}
