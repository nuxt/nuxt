import process from 'node:process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { acquireBuildLock } from '../src/core/build-lock.ts'
import type { BuildLockError } from '../src/core/build-lock.ts'

describe('build-lock', async () => {
  const workspaceDir = await findWorkspaceDir()
  const tmpDir = join(workspaceDir, '.test/build-lock')

  beforeEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    mkdirSync(tmpDir, { recursive: true })
  })

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('acquires lock and creates lock file', () => {
    const release = acquireBuildLock(tmpDir)
    const lockPath = join(tmpDir, '.build.lock')

    expect(existsSync(lockPath)).toBe(true)

    const data = JSON.parse(readFileSync(lockPath, 'utf-8'))
    expect(data.pid).toBe(process.pid)
    expect(data.startedAt).toBeTruthy()

    release()
    expect(existsSync(lockPath)).toBe(false)
  })

  it('allows re-acquire by same PID', () => {
    const release1 = acquireBuildLock(tmpDir)
    const release2 = acquireBuildLock(tmpDir)

    release2()
    release1()
  })

  it('throws when another live process holds the lock', () => {
    // Use PID 1 (init/systemd) which is always alive
    const lockPath = join(tmpDir, '.build.lock')
    writeFileSync(lockPath, JSON.stringify({ pid: 1, startedAt: new Date().toISOString() }))

    try {
      acquireBuildLock(tmpDir)
      expect.unreachable('should have thrown')
    } catch (err: unknown) {
      const error = err as Error & BuildLockError
      expect(error.message).toContain('Another Nuxt build is already running')
      expect(error.message).toContain('remove the lock file')
      expect(error.message).toMatch(/started \d+ seconds? ago/)
      expect(error.pid).toBe(1)
      expect(error.startedAt).toBeTruthy()
    }
  })

  it('overwrites stale lock from dead process', () => {
    const lockPath = join(tmpDir, '.build.lock')
    // PID 99999999 should not exist
    writeFileSync(lockPath, JSON.stringify({ pid: 99999999, startedAt: new Date().toISOString() }))

    const release = acquireBuildLock(tmpDir)
    const data = JSON.parse(readFileSync(lockPath, 'utf-8'))
    expect(data.pid).toBe(process.pid)

    release()
  })

  it('overwrites lock from live process if older than max age', () => {
    const lockPath = join(tmpDir, '.build.lock')
    // PID 1 is alive, but timestamp is 20 minutes ago (past MAX_LOCK_AGE_MS of 10 min)
    const oldDate = new Date(Date.now() - 20 * 60 * 1000).toISOString()
    writeFileSync(lockPath, JSON.stringify({ pid: 1, startedAt: oldDate }))

    const release = acquireBuildLock(tmpDir)
    const data = JSON.parse(readFileSync(lockPath, 'utf-8'))
    expect(data.pid).toBe(process.pid)

    release()
  })

  it('handles corrupted lock file gracefully', () => {
    const lockPath = join(tmpDir, '.build.lock')
    writeFileSync(lockPath, 'not json')

    const release = acquireBuildLock(tmpDir)
    expect(existsSync(lockPath)).toBe(true)

    release()
  })

  it('release is idempotent', () => {
    const release = acquireBuildLock(tmpDir)
    release()
    release() // should not throw
  })

  it('creates buildDir if it does not exist', () => {
    const nestedDir = join(tmpDir, 'nested/deep/dir')
    const release = acquireBuildLock(nestedDir)

    expect(existsSync(join(nestedDir, '.build.lock'))).toBe(true)
    release()
  })
})
