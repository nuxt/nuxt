import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { join } from 'pathe'
import type { Nuxt } from '@nuxt/schema'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { nitroStub } = vi.hoisted(() => ({
  nitroStub: { options: { virtual: {} as Record<string, any>, _config: { virtual: {} as Record<string, any> } } },
}))

vi.mock('@nuxt/kit', async orig => ({
  ...(await orig() as object),
  useNitro: () => nitroStub,
  tryUseNuxt: () => ({}),
  resolveAlias: (id: string) => id,
  directoryToURL: (d: string) => d,
}))

const { NastiNodePlugin, listenAndRestrict, pickSocketPath } = await import('../../src/plugins/nasti-node.ts')

// ---- pickSocketPath / listenAndRestrict (mirror @nuxt/vite-builder) ----------

const createdDirs: string[] = []

function trackedPick (platform: NodeJS.Platform = process.platform, tmpdir?: string) {
  const info = pickSocketPath(platform, tmpdir)
  if (info.parentDir) {
    createdDirs.push(info.parentDir)
  }
  return info
}

function createSocketTmpdir () {
  const dir = fs.mkdtempSync(join(process.platform === 'win32' ? os.tmpdir() : '/tmp', 'nuxt-nasti-test-'))
  createdDirs.push(dir)
  return dir
}

afterEach(() => {
  while (createdDirs.length) {
    fs.rmSync(createdDirs.pop()!, { recursive: true, force: true })
  }
})

describe('pickSocketPath', () => {
  it('uses a filesystem socket on Linux/macOS, not an abstract-namespace socket', () => {
    for (const platform of ['linux', 'darwin'] as const) {
      const tmpdir = createSocketTmpdir()
      const { socketPath, parentDir } = trackedPick(platform, tmpdir)
      expect(socketPath.startsWith('\0')).toBe(false)
      expect(parentDir).toBeDefined()
      expect(fs.realpathSync(parentDir!).startsWith(fs.realpathSync(tmpdir))).toBe(true)
    }
  })

  it('uses a named pipe on Windows', () => {
    const { socketPath, parentDir } = pickSocketPath('win32')
    expect(socketPath.startsWith('\\\\.\\pipe\\')).toBe(true)
    expect(parentDir).toBeUndefined()
  })

  it('places the socket in a 0700 parent directory on Unix', { skip: process.platform === 'win32' }, () => {
    const { parentDir } = trackedPick()
    expect(fs.statSync(parentDir!).mode & 0o777).toBe(0o700)
  })

  it('falls back to /tmp within the sun_path limit when $TMPDIR is too long', { skip: process.platform === 'win32' }, () => {
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
  it.runIf(process.platform !== 'win32')('binds a Unix socket with mode 0600', async () => {
    const { socketPath } = trackedPick()
    const server = net.createServer()
    await new Promise<void>((resolve, reject) => {
      server.once('listening', () => resolve())
      server.once('error', reject)
      listenAndRestrict(server, socketPath)
    })
    try {
      expect(fs.statSync(socketPath).mode & 0o777).toBe(0o600)
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })

  it.runIf(process.platform === 'win32')('binds a Windows named pipe without chmod', async () => {
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

// ---- NastiNodePlugin IPC server ---------------------------------------------

function createNuxt (overrides: Record<string, any> = {}) {
  const hooks: Record<string, Array<(...args: any[]) => any>> = {}
  return {
    options: {
      dev: true,
      srcDir: '/repo/app',
      appDir: '/repo/app-dir',
      css: [],
      alias: {},
      modulesDir: [],
      features: {},
      devServer: { url: 'http://localhost:3000' },
      vite: {},
      ...overrides,
    },
    apps: { default: { mainComponent: '/repo/app/app.vue' } },
    hook: vi.fn((name: string, fn: (...args: any[]) => any) => {
      ;(hooks[name] ||= []).push(fn)
    }),
    _hooks: hooks,
  } as unknown as Nuxt
}

function frame (payload: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(payload), 'utf-8')
  const full = Buffer.alloc(4 + body.length)
  full.writeUInt32BE(body.length, 0)
  body.copy(full, 4)
  return full
}

function ipcRequest (socketPath: string, payload: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath)
    let buffer = Buffer.alloc(0)
    socket.on('connect', () => socket.write(frame(payload)))
    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data])
      if (buffer.length < 4) {
        return
      }
      const len = buffer.readUInt32BE(0)
      if (buffer.length >= 4 + len) {
        const json = buffer.subarray(4, 4 + len).toString('utf-8')
        socket.end()
        resolve(JSON.parse(json))
      }
    })
    socket.on('error', reject)
  })
}

async function waitFor (fn: () => boolean, timeout = 2000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (fn()) {
      return
    }
    await new Promise(r => setTimeout(r, 20))
  }
  throw new Error('waitFor timed out')
}

describe('NastiNodePlugin', () => {
  let activePlugin: any
  const savedEnv = process.env.NUXT_NASTI_NODE_OPTIONS

  afterEach(async () => {
    if (activePlugin?.buildEnd) {
      await activePlugin.buildEnd()
    }
    activePlugin = undefined
    if (savedEnv === undefined) {
      delete process.env.NUXT_NASTI_NODE_OPTIONS
    } else {
      process.env.NUXT_NASTI_NODE_OPTIONS = savedEnv
    }
  })

  it('is a no-op outside dev mode', () => {
    expect(NastiNodePlugin(createNuxt({ dev: false }))).toBeUndefined()
  })

  it('registers the server/runner/manifest virtuals at construction', () => {
    nitroStub.options.virtual = {}
    activePlugin = NastiNodePlugin(createNuxt())

    expect(nitroStub.options.virtual['#build/dist/server/server.mjs']).toBeDefined()
    expect(nitroStub.options.virtual['#build/dist/server/runner.mjs']).toBeDefined()
    expect(nitroStub.options.virtual['#build/dist/server/client.manifest.mjs']).toBeDefined()
  })

  it.runIf(process.platform !== 'win32')('answers manifest / resolve / module requests over the IPC socket', async () => {
    const nuxt = createNuxt()
    activePlugin = NastiNodePlugin(nuxt)

    const server = {
      environments: {
        ssr: {
          options: { entry: ['/repo/.nuxt/entry-server.mjs'] },
          pluginContainer: { resolveId: vi.fn((id: string) => Promise.resolve({ id: '/resolved' + id })) },
        },
        client: { moduleGraph: { getModulesByFile: vi.fn(() => []) } },
      },
      transformRequest: vi.fn((id: string) => Promise.resolve({ code: `CODE:${id}`, map: null })),
    }

    activePlugin.configureServer(server)

    const opts = JSON.parse(process.env.NUXT_NASTI_NODE_OPTIONS!)
    expect(opts.root).toBe('/repo/app')
    expect(opts.entryPath).toBe('/repo/.nuxt/entry-server.mjs')
    const socketPath: string = opts.socketPath
    await waitFor(() => fs.existsSync(socketPath))

    const manifest = await ipcRequest(socketPath, { id: 1, type: 'manifest', payload: undefined })
    expect(manifest.type).toBe('response')
    expect(JSON.stringify(manifest.data)).toContain('@nasti/client')

    const resolved = await ipcRequest(socketPath, { id: 2, type: 'resolve', payload: { id: 'vue' } })
    expect(resolved.data).toEqual({ id: '/resolvedvue' })

    const mod = await ipcRequest(socketPath, { id: 3, type: 'module', payload: { moduleId: '/app.js' } })
    expect(mod.data).toMatchObject({ id: '/app.js', code: 'CODE:/app.js' })
    expect(server.transformRequest).toHaveBeenCalledWith('/app.js')
  })
})
