import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { join } from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { listenAndRestrict, pickSocketPath } from '../src/plugins/vite-node.ts'

const createdDirs: string[] = []

function trackedPick (platform: NodeJS.Platform = process.platform) {
  const info = pickSocketPath(platform)
  if (info.parentDir) {
    createdDirs.push(info.parentDir)
  }
  return info
}

afterEach(() => {
  while (createdDirs.length) {
    const dir = createdDirs.pop()!
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

const realTmpdir = fs.realpathSync(os.tmpdir())

describe('pickSocketPath', () => {
  it('uses a filesystem socket on Linux, not an abstract namespace socket', () => {
    const { socketPath, parentDir } = trackedPick('linux')
    expect(socketPath.startsWith('\0')).toBe(false)
    expect(parentDir).toBeDefined()
    expect(fs.realpathSync(parentDir!).startsWith(realTmpdir)).toBe(true)
  })

  it('uses a filesystem socket on macOS', () => {
    const { socketPath, parentDir } = trackedPick('darwin')
    expect(socketPath.startsWith('\0')).toBe(false)
    expect(parentDir).toBeDefined()
    expect(fs.realpathSync(parentDir!).startsWith(realTmpdir)).toBe(true)
  })

  it('uses a named pipe on Windows', () => {
    const { socketPath, parentDir } = pickSocketPath('win32')
    expect(socketPath.startsWith('\0')).toBe(false)
    expect(socketPath.startsWith('\\\\.\\pipe\\')).toBe(true)
    expect(parentDir).toBeUndefined()
  })

  it('places the socket in a 0700 parent directory on Unix', { skip: process.platform === 'win32' }, () => {
    const { parentDir } = trackedPick()
    const stat = fs.statSync(parentDir!)
    expect(stat.mode & 0o777).toBe(0o700)
  })

  it('falls back to /tmp and stays within the `sun_path` limit when $TMPDIR is too long', { skip: process.platform === 'win32' }, () => {
    const max = process.platform === 'linux' ? 108 : 104
    const longTmpdir = fs.mkdtempSync(join(os.tmpdir(), 'x'.repeat(80)))
    createdDirs.push(longTmpdir)

    const { socketPath, parentDir } = pickSocketPath(process.platform, longTmpdir)
    if (parentDir) {
      createdDirs.push(parentDir)
    }

    expect(parentDir?.startsWith('/tmp/')).toBe(true)
    expect(Buffer.byteLength(socketPath)).toBeLessThanOrEqual(max)
  })
})

describe('listenAndRestrict', () => {
  it.runIf(process.platform !== 'win32')('binds a socket with mode 0600', async () => {
    const { socketPath } = trackedPick()
    const server = net.createServer()
    await new Promise<void>((resolve, reject) => {
      server.once('listening', () => resolve())
      server.once('error', reject)
      listenAndRestrict(server, socketPath)
    })
    try {
      const stat = fs.statSync(socketPath)
      expect(stat.mode & 0o777).toBe(0o600)
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })

  it.runIf(process.platform !== 'win32')('binds with no group/other permission bits before the listening callback fires', () => {
    const { socketPath } = trackedPick()
    const server = net.createServer()
    listenAndRestrict(server, socketPath)
    const stat = fs.statSync(socketPath)
    expect(stat.mode & 0o077).toBe(0)
    server.close()
  })

  it.runIf(process.platform === 'win32')('binds on a Windows named pipe without attempting chmod', async () => {
    const { socketPath } = pickSocketPath('win32')
    const chmodSpy = vi.spyOn(fs, 'chmodSync')
    const server = net.createServer()
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('listening', () => resolve())
        server.once('error', reject)
        listenAndRestrict(server, socketPath)
      })
      expect(chmodSpy).not.toHaveBeenCalledWith(socketPath, expect.anything())
    } finally {
      chmodSpy.mockRestore()
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })
})
