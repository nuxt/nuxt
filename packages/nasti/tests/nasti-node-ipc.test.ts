import net from 'node:net'
import fs from 'node:fs'
import os from 'node:os'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { join } from 'pathe'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NastiNodeFetch } from '../src/plugins/nasti-node.ts'

function frame (payload: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(payload), 'utf-8')
  const full = Buffer.alloc(4 + body.length)
  full.writeUInt32BE(body.length, 0)
  body.copy(full, 4)
  return full
}

describe.skipIf(process.platform === 'win32')('nastiNodeFetch IPC client', () => {
  let server: net.Server
  let socketDir: string
  let socketPath: string
  const conns: net.Socket[] = []
  let nastiNodeFetch: NastiNodeFetch

  beforeAll(async () => {
    socketDir = fs.mkdtempSync(join(os.tmpdir(), 'nuxt-nasti-ipc-'))
    socketPath = join(socketDir, 'test.sock')

    server = net.createServer((socket) => {
      conns.push(socket)
      let buffer = Buffer.alloc(0)
      socket.on('error', () => {})
      socket.on('data', (data) => {
        buffer = Buffer.concat([buffer, data])
        while (buffer.length >= 4) {
          const len = buffer.readUInt32BE(0)
          if (buffer.length < 4 + len) {
            break
          }
          const req = JSON.parse(buffer.subarray(4, 4 + len).toString('utf-8'))
          buffer = buffer.subarray(4 + len)
          handle(socket, req)
        }
      })
    })

    await new Promise<void>(resolve => server.listen(socketPath, resolve))
    process.env.NUXT_NASTI_NODE_OPTIONS = JSON.stringify({ socketPath, baseURL: 'http://localhost:3000' })
  })

  beforeEach(async () => {
    vi.resetModules()
    nastiNodeFetch = (await import('../src/nasti-node.ts')).nastiNodeFetch
  })

  afterAll(async () => {
    for (const c of conns) {
      c.destroy()
    }
    await new Promise<void>(resolve => server.close(() => resolve()))
    fs.rmSync(socketDir, { recursive: true, force: true })
    delete process.env.NUXT_NASTI_NODE_OPTIONS
  })

  function handle (socket: net.Socket, req: any) {
    const reply = (data: unknown) => socket.write(frame({ id: req.id, type: 'response', data }))
    switch (req.type) {
      case 'manifest':
        return reply({ '@nasti/client': { file: '@nasti/client', isEntry: true } })
      case 'invalidates':
        return reply(['/a.vue', '/b.vue'])
      case 'resolve':
        if (req.payload?.id === 'BOOM') {
          return socket.write(frame({ id: req.id, type: 'error', error: { message: 'boom', status: 500 } }))
        }
        return reply({ id: '/resolved/' + req.payload.id })
      case 'module':
        return reply({ id: req.payload.moduleId, code: 'CODE' })
    }
  }

  it('round-trips a manifest request', async () => {
    const manifest = await nastiNodeFetch.getManifest()
    expect(manifest['@nasti/client']).toBeDefined()
  })

  it('round-trips an invalidates request', async () => {
    expect(await nastiNodeFetch.getInvalidates()).toEqual(['/a.vue', '/b.vue'])
  })

  it('round-trips a resolve request', async () => {
    expect(await nastiNodeFetch.resolveId('vue')).toEqual({ id: '/resolved/vue' })
  })

  it('round-trips a module request', async () => {
    expect(await nastiNodeFetch.fetchModule('/app.js')).toEqual({ id: '/app.js', code: 'CODE' })
  })

  it('rejects with the server error message for an error frame', async () => {
    await expect(nastiNodeFetch.resolveId('BOOM')).rejects.toThrow('boom')
  })

  it('reconnects after the connection is dropped', async () => {
    await nastiNodeFetch.getManifest()

    // drop every server-side connection, then let the client observe the close.
    for (const c of conns.splice(0)) {
      c.destroy()
    }
    await new Promise(r => setTimeout(r, 300))

    expect((await nastiNodeFetch.getManifest())['@nasti/client']).toBeDefined()
  })
})
