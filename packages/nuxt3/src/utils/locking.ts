import path from 'path'
import consola from 'consola'
import hash from 'hash-sum'
import fs from 'fs-extra'
import properlock from 'proper-lockfile'
import onExit from 'signal-exit'

export const lockPaths = new Set()

export const defaultLockOptions = {
  stale: 30000,
  onCompromised: err => consola.warn(err)
}

export function getLockOptions (options) {
  return Object.assign({}, defaultLockOptions, options)
}

export function createLockPath ({ id = 'nuxt', dir, root }) {
  const sum = hash(`${root}-${dir}`)

  return path.resolve(root, 'node_modules/.cache/nuxt', `${id}-lock-${sum}`)
}

export async function getLockPath (config) {
  const lockPath = createLockPath(config)

  // the lock is created for the lockPath as ${lockPath}.lock
  // so the (temporary) lockPath needs to exist
  await fs.ensureDir(lockPath)

  return lockPath
}

export async function lock ({ id, dir, root, options }) {
  const lockPath = await getLockPath({ id, dir, root })

  try {
    const locked = await properlock.check(lockPath)
    if (locked) {
      consola.fatal(`A lock with id '${id}' already exists on ${dir}`)
    }
  } catch (e) {
    consola.debug(`Check for an existing lock with id '${id}' on ${dir} failed`, e)
  }

  let lockWasCompromised = false
  let release

  try {
    options = getLockOptions(options)

    const onCompromised = options.onCompromised
    options.onCompromised = (err) => {
      onCompromised(err)
      lockWasCompromised = true
    }

    release = await properlock.lock(lockPath, options)
  } catch (e) {}

  if (!release) {
    consola.warn(`Unable to get a lock with id '${id}' on ${dir} (but will continue)`)
    return false
  }

  if (!lockPaths.size) {
    // make sure to always cleanup our temporary lockPaths
    onExit(() => {
      for (const lockPath of lockPaths) {
        fs.removeSync(lockPath)
      }
    })
  }

  lockPaths.add(lockPath)

  return async function lockRelease () {
    try {
      await fs.remove(lockPath)
      lockPaths.delete(lockPath)

      // release as last so the lockPath is still removed
      // when it fails on a compromised lock
      await release()
    } catch (e) {
      if (!lockWasCompromised || !e.message.includes('already released')) {
        consola.debug(e)
        return
      }

      // proper-lockfile doesnt remove lockDir when lock is compromised
      // removing it here could cause the 'other' process to throw an error
      // as well, but in our case its much more likely the lock was
      // compromised due to mtime update timeouts
      const lockDir = `${lockPath}.lock`
      if (await fs.exists(lockDir)) {
        await fs.remove(lockDir)
      }
    }
  }
}
