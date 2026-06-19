import process from 'node:process'
import type { Socket } from 'node:net'
import net from 'node:net'
import { Buffer } from 'node:buffer'
import { isTest } from 'std-env'
import type { NastiNodeFetch, NastiNodeRequestMap, NastiNodeServerOptions } from './plugins/nasti-node.ts'

// The `#nasti-node` module: runs inside the Nitro process and talks to the Nasti dev
// server over a Unix socket / named pipe. Mirrors `@nuxt/vite-builder`'s `#vite-node`
// client (length-prefixed JSON frames, exponential-backoff reconnect).

function getOptions (): NastiNodeServerOptions {
  try {
    return JSON.parse(process.env.NUXT_NASTI_NODE_OPTIONS || '{}')
  } catch (e) {
    console.error('nasti-node: failed to parse NUXT_NASTI_NODE_OPTIONS.', e)
    return {} as NastiNodeServerOptions
  }
}

export const nastiNodeOptions: NastiNodeServerOptions = getOptions()

const pendingRequests = new Map<number, { resolve: (v: any) => void, reject: (e?: any) => void }>()
let requestIdCounter = 0
let clientSocket: Socket | undefined
let currentConnectPromise: Promise<Socket> | undefined

const MAX_RETRY_ATTEMPTS = nastiNodeOptions.maxRetryAttempts ?? 5
const BASE_RETRY_DELAY_MS = nastiNodeOptions.baseRetryDelay ?? 100
const MAX_RETRY_DELAY_MS = nastiNodeOptions.maxRetryDelay ?? 2000
const REQUEST_TIMEOUT_MS = nastiNodeOptions.requestTimeout ?? 60000

function retryDelay (attempt: number): number {
  const exp = BASE_RETRY_DELAY_MS * Math.pow(2, attempt)
  return Math.min(exp + Math.random() * 0.1 * exp, MAX_RETRY_DELAY_MS)
}

function connectSocket (): Promise<Socket> {
  if (clientSocket && !clientSocket.destroyed) {
    return Promise.resolve(clientSocket)
  }
  if (currentConnectPromise) {
    return currentConnectPromise
  }

  const thisPromise = new Promise<Socket>((resolve, reject) => {
    if (!nastiNodeOptions.socketPath) {
      return reject(new Error('nasti-node: socketPath is not configured.'))
    }

    const attempt = (n = 0) => {
      const socket = net.createConnection(nastiNodeOptions.socketPath)
      let buffer = Buffer.alloc(64 * 1024)
      let writeOffset = 0
      let readOffset = 0
      socket.setNoDelay(true)
      socket.setKeepAlive(true, 30000)

      const cleanup = () => {
        socket.off('connect', onConnect)
        socket.off('data', onData)
        socket.off('error', onError)
        socket.off('close', onClose)
      }
      const failAll = (err: Error) => {
        for (const { reject: rej } of pendingRequests.values()) {
          rej(err)
        }
        pendingRequests.clear()
        if (clientSocket === socket) {
          clientSocket = undefined
        }
        if (currentConnectPromise === thisPromise) {
          currentConnectPromise = undefined
        }
      }

      const onConnect = () => {
        clientSocket = socket
        resolve(socket)
      }
      const onData = (data: Buffer) => {
        if (writeOffset + data.length > buffer.length) {
          const grown = Buffer.alloc(Math.max(buffer.length * 2, writeOffset + data.length))
          buffer.copy(grown, 0, 0, writeOffset)
          buffer = grown
        }
        data.copy(buffer, writeOffset)
        writeOffset += data.length

        while (writeOffset - readOffset >= 4) {
          const len = buffer.readUInt32BE(readOffset)
          if (writeOffset - readOffset < 4 + len) {
            break
          }
          const json = buffer.subarray(readOffset + 4, readOffset + 4 + len).toString('utf-8')
          readOffset += 4 + len
          try {
            const response = JSON.parse(json)
            const handlers = pendingRequests.get(response.id)
            if (!handlers) {
              continue
            }
            pendingRequests.delete(response.id)
            if (response.type === 'error') {
              const err: Error & Record<string, any> = new Error(response.error?.message)
              if (response.error?.stack) {
                err.stack = response.error.stack
              }
              err.data = response.error?.data
              err.statusCode = err.status = response.error?.status
              err._fromServer = true
              handlers.reject(err)
            } else {
              handlers.resolve(response.data)
            }
          } catch {
            // ignore malformed frame
          }
        }
        if (readOffset > 0) {
          buffer.copy(buffer, 0, readOffset, writeOffset)
          writeOffset -= readOffset
          readOffset = 0
        }
      }
      const onError = (err: Error) => {
        cleanup()
        if (n < MAX_RETRY_ATTEMPTS) {
          setTimeout(() => attempt(n + 1), retryDelay(n))
        } else {
          if (currentConnectPromise === thisPromise) {
            reject(err)
          }
          failAll(err)
        }
      }
      const onClose = () => {
        cleanup()
        failAll(new Error('nasti-node: IPC connection closed'))
      }

      socket.on('connect', onConnect)
      socket.on('data', onData)
      socket.on('error', onError)
      socket.on('close', onClose)
    }

    attempt()
  })

  currentConnectPromise = thisPromise
  return currentConnectPromise
}

async function sendRequest<T extends keyof NastiNodeRequestMap> (type: T, payload: NastiNodeRequestMap[T]['request']): Promise<NastiNodeRequestMap[T]['response']> {
  const requestId = requestIdCounter++
  let lastError: unknown

  for (let n = 0; n <= MAX_RETRY_ATTEMPTS; n++) {
    try {
      const socket = await connectSocket()
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingRequests.delete(requestId)
          reject(new Error(`nasti-node: request timeout after ${REQUEST_TIMEOUT_MS}ms (${type})`))
        }, REQUEST_TIMEOUT_MS)
        pendingRequests.set(requestId, {
          resolve: (v) => { clearTimeout(timeout); resolve(v) },
          reject: (e) => { clearTimeout(timeout); reject(e) },
        })
        const messageBuffer = Buffer.from(JSON.stringify({ id: requestId, type, payload }), 'utf-8')
        const full = Buffer.alloc(4 + messageBuffer.length)
        full.writeUInt32BE(messageBuffer.length, 0)
        messageBuffer.copy(full, 4)
        try {
          socket.write(full)
        } catch (error) {
          clearTimeout(timeout)
          pendingRequests.delete(requestId)
          reject(error)
        }
      })
    } catch (error) {
      lastError = error
      if (error && typeof error === 'object' && '_fromServer' in error) {
        break // application error from the server — don't retry
      }
      if (n < MAX_RETRY_ATTEMPTS) {
        await new Promise(r => setTimeout(r, retryDelay(n)))
        clientSocket?.destroy()
        clientSocket = undefined
        currentConnectPromise = undefined
      }
    }
  }
  throw lastError || new Error('nasti-node: request failed after all retries')
}

export const nastiNodeFetch: NastiNodeFetch = {
  getManifest () {
    return sendRequest('manifest', undefined)
  },
  getInvalidates () {
    return sendRequest('invalidates', undefined)
  },
  resolveId (id, importer) {
    return sendRequest('resolve', { id, importer })
  },
  fetchModule (moduleId) {
    return sendRequest('module', { moduleId })
  },
  ensureConnected () {
    return connectSocket()
  },
}

// Pre-establish the connection to shave latency off the first SSR request.
let preConnectAttempted = false
if (typeof process !== 'undefined' && !isTest) {
  setTimeout(() => {
    if (preConnectAttempted || !nastiNodeOptions.socketPath) {
      return
    }
    preConnectAttempted = true
    connectSocket().catch(() => {})
  }, 100)
}
