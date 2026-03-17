import process from 'node:process'
import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, relative } from 'pathe'

const LOCK_FILENAME = '.build.lock'

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

function lockAge (lock: LockData): number {
  return Date.now() - new Date(lock.startedAt).getTime()
}

function formatAge (ms: number): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'always', style: 'long' })
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) { return rtf.format(-seconds, 'second') }
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) { return rtf.format(-minutes, 'minute') }
  return rtf.format(-Math.round(minutes / 60), 'hour')
}

function isLockActive (lock: LockData): boolean {
  if (lock.pid === process.pid) { return false }
  if (!isProcessAlive(lock.pid)) { return false }
  if (lockAge(lock) > MAX_LOCK_AGE_MS) { return false }
  return true
}

function throwLockError (lock: LockData, lockPath: string, rootDir?: string): never {
  const age = formatAge(lockAge(lock))
  const displayPath = rootDir ? relative(rootDir, lockPath) : lockPath
  const err = new Error(
    `Another Nuxt build is already running (PID ${lock.pid}, started ${age}).\n`
    + `If the previous build process crashed, you can remove the stale lock file: ${displayPath}`,
  ) as Error & BuildLockError
  err.pid = lock.pid
  err.startedAt = lock.startedAt
  throw err
}

export function acquireBuildLock (buildDir: string, rootDir?: string): () => void {
  mkdirSync(buildDir, { recursive: true })

  const lockPath = join(buildDir, LOCK_FILENAME)

  const existing = readLock(lockPath)
  if (existing && isLockActive(existing)) {
    throwLockError(existing, lockPath, rootDir)
  }

  const lockData: LockData = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
  }

  const content = JSON.stringify(lockData, null, 2)

  try {
    const fd = openSync(lockPath, 'wx')
    try {
      writeFileSync(fd, content)
    } finally {
      closeSync(fd)
    }
  } catch (error: any) {
    if (error?.code === 'EEXIST') {
      const current = readLock(lockPath)
      if (current && isLockActive(current)) {
        throwLockError(current, lockPath, rootDir)
      }
    }
    writeFileSync(lockPath, content)
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
