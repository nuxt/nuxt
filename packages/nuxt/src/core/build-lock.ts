import process from 'node:process'
import { close as fdClose, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'pathe'

const LOCK_FILENAME = '.build.lock'

// Max age before a lock is considered stale regardless of PID status (10 min).
// Guards against PID recycling on all platforms.
const MAX_LOCK_AGE_MS = 10 * 60 * 1000

interface LockData {
  pid: number
  startedAt: string
}

export interface BuildLockError {
  pid: number
  startedAt: string
}

function isProcessAlive (pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (err: any) {
    // EPERM means the process exists but we lack permission to signal it
    return err?.code === 'EPERM'
  }
}

function readLock (lockPath: string): LockData | null {
  try {
    return JSON.parse(readFileSync(lockPath, 'utf-8'))
  } catch {
    return null
  }
}

function isLockStale (lock: LockData): boolean {
  const age = Date.now() - new Date(lock.startedAt).getTime()
  return age > MAX_LOCK_AGE_MS
}

/**
 * Attempts to acquire an exclusive build lock.
 * Returns a release function on success, or throws with `pid` and `startedAt`
 * properties on the error so callers can implement their own retry strategy.
 */
export function acquireBuildLock (buildDir: string): () => void {
  mkdirSync(buildDir, { recursive: true })

  const lockPath = join(buildDir, LOCK_FILENAME)

  const existing = readLock(lockPath)
  if (existing && existing.pid !== process.pid && isProcessAlive(existing.pid) && !isLockStale(existing)) {
    const err = new Error(
      `Another Nuxt build is already running (PID ${existing.pid}, started ${existing.startedAt}).\n`
      + `If this is unexpected, you can remove the lock file: ${lockPath}`,
    ) as Error & BuildLockError
    err.pid = existing.pid
    err.startedAt = existing.startedAt
    throw err
  }

  const lockData: LockData = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
  }

  // Use exclusive create (wx) to reduce race window between two concurrent acquires.
  // If it fails (file exists from stale lock we're overwriting), fall back to normal write.
  try {
    const fd = openSync(lockPath, 'wx')
    const content = JSON.stringify(lockData, null, 2)
    writeFileSync(fd, content)
    fdClose(fd, () => {})
  } catch {
    writeFileSync(lockPath, JSON.stringify(lockData, null, 2))
  }

  let released = false
  return () => {
    if (released) { return }
    released = true
    try {
      const current = readLock(lockPath)
      if (current && current.pid === process.pid) {
        unlinkSync(lockPath)
      }
    } catch {
      // ignore cleanup errors — file may already be gone (e.g. manual delete, CI cleanup)
    }
  }
}
