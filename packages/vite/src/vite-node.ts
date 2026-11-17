import process from 'node:process'
import type { Socket } from 'node:net'
import net from 'node:net'
import { isTest } from 'std-env'
import type { ViteNodeFetch, ViteNodeRequestMap, ViteNodeServerOptions } from './plugins/vite-node.ts'
import { createMessageDecoder, encodeMessage } from './utils/ipc.ts'

function getViteNodeOptionsEnvVar () {
  const envVar = process.env.NUXT_VITE_NODE_OPTIONS
  try {
    return JSON.parse(envVar || '{}')
  } catch (e) {
    console.error('vite-node-shared: Failed to parse NUXT_VITE_NODE_OPTIONS environment variable.', e)
    return {}
  }
}

export const viteNodeOptions: ViteNodeServerOptions = getViteNodeOptionsEnvVar()

const pendingRequests = new Map<number, { resolve: (value: any) => void, reject: (reason?: any) => void }>()
let requestIdCounter = 0
let clientSocket: Socket | undefined
let currentConnectPromise: Promise<Socket> | undefined
const MAX_RETRY_ATTEMPTS = viteNodeOptions.maxRetryAttempts ?? 5
const BASE_RETRY_DELAY_MS = viteNodeOptions.baseRetryDelay ?? 100
const MAX_RETRY_DELAY_MS = viteNodeOptions.maxRetryDelay ?? 2000
const REQUEST_TIMEOUT_MS = viteNodeOptions.requestTimeout ?? 60000

/**
 * Calculates exponential backoff delay with jitter.
 * @param attempt - The current attempt number (0-based).
 * @returns Delay in milliseconds.
 */
function calculateRetryDelay (attempt: number): number {
  const exponentialDelay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt)
  const jitter = Math.random() * 0.1 * exponentialDelay // Add 10% jitter
  return Math.min(exponentialDelay + jitter, MAX_RETRY_DELAY_MS)
}

/**
 * Establishes or returns an existing IPC socket connection with retry logic.
 * @returns A promise that resolves with the connected socket.
 */
function connectSocket (): Promise<Socket> {
  if (clientSocket && !clientSocket.destroyed) {
    return Promise.resolve(clientSocket)
  }

  if (currentConnectPromise) {
    return currentConnectPromise
  }

  const thisPromise = new Promise<Socket>((resolve, reject) => {
    if (!viteNodeOptions.socketPath) {
      console.error('vite-node-shared: NUXT_VITE_NODE_OPTIONS.socketPath is not defined.')
      return reject(new Error('Vite Node IPC socket path not configured.'))
    }

    const attemptConnection = (attempt = 0) => {
      const socket = net.createConnection(viteNodeOptions.socketPath)
      socket.setNoDelay(true)
      socket.setKeepAlive(true, 30000) // 30s

      const cleanup = () => {
        socket.off('connect', onConnect)
        socket.off('data', onData)
        socket.off('error', onError)
        socket.off('close', onClose)
      }

      const decoder = createMessageDecoder((message) => {
        try {
          const response = JSON.parse(message)
          const requestHandlers = pendingRequests.get(response.id)
          if (requestHandlers) {
            const { resolve: resolveRequest, reject: rejectRequest } = requestHandlers
            if (response.type === 'error') {
              const err: Error & { stack?: string, data?: unknown, status?: number, statusCode?: number, _fromServer?: boolean } = new Error(response.error.message)
              if (response.error.stack) {
                err.stack = response.error.stack
              }
              err.data = response.error.data
              err.statusCode = err.status = response.error.status || response.error.statusCode
              err._fromServer = true
              rejectRequest(err)
            } else {
              resolveRequest(response.data)
            }
            pendingRequests.delete(response.id)
          }
        } catch (parseError) {
          console.warn('vite-node-shared: Failed to parse IPC response:', parseError)
        }
      }, (requiredSize, maxSize) => new Error(`Buffer size limit exceeded: ${requiredSize} > ${maxSize}`))

      const onConnect = () => {
        clientSocket = socket
        resolve(socket)
      }

      const onData = (data: Buffer) => {
        try {
          decoder.push(data)
        } catch (error) {
          socket.destroy(error instanceof Error ? error : new Error('Buffer management error'))
        }
      }

      const onError = (err: Error) => {
        cleanup()
        decoder.reset()

        if (attempt < MAX_RETRY_ATTEMPTS) {
          const delay = calculateRetryDelay(attempt)
          setTimeout(() => attemptConnection(attempt + 1), delay)
        } else {
          if (currentConnectPromise === thisPromise) {
            reject(err)
          }
          for (const { reject: rejectRequest } of pendingRequests.values()) {
            rejectRequest(err)
          }
          pendingRequests.clear()
          if (clientSocket === socket) { clientSocket = undefined }
          if (currentConnectPromise === thisPromise) { currentConnectPromise = undefined }
        }
      }

      const onClose = () => {
        cleanup()
        decoder.reset()
        for (const { reject: rejectRequest } of pendingRequests.values()) {
          rejectRequest(new Error('IPC connection closed'))
        }
        pendingRequests.clear()
        if (clientSocket === socket) { clientSocket = undefined }
        if (currentConnectPromise === thisPromise) { currentConnectPromise = undefined }
      }

      socket.on('connect', onConnect)
      socket.on('data', onData)
      socket.on('error', onError)
      socket.on('close', onClose)
    }

    attemptConnection()
  })

  currentConnectPromise = thisPromise
  return currentConnectPromise
}

/**
 * Sends a request over the IPC socket with automatic reconnection.
 */
async function sendRequest<T extends keyof ViteNodeRequestMap> (type: T, payload: ViteNodeRequestMap[T]['request']): Promise<ViteNodeRequestMap[T]['response']> {
  const requestId = requestIdCounter++
  let lastError

  // retry the entire request (including reconnection) up to MAX_RETRY_ATTEMPTS times
  for (let requestAttempt = 0; requestAttempt <= MAX_RETRY_ATTEMPTS; requestAttempt++) {
    try {
      const socket = await connectSocket()

      return await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          pendingRequests.delete(requestId)
          reject(new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms for type: ${type}`))
        }, REQUEST_TIMEOUT_MS)

        pendingRequests.set(requestId, {
          resolve: (value) => {
            clearTimeout(timeoutId)
            resolve(value)
          },
          reject: (reason) => {
            clearTimeout(timeoutId)
            reject(reason)
          },
        })

        try {
          socket.write(encodeMessage({ id: requestId, type, payload }))
        } catch (error) {
          clearTimeout(timeoutId)
          pendingRequests.delete(requestId)
          reject(error)
        }
      })
    } catch (error) {
      lastError = error
      // Don't retry application-level errors from the server
      if (error && typeof error === 'object' && '_fromServer' in error) {
        break
      }
      if (requestAttempt < MAX_RETRY_ATTEMPTS) {
        const delay = calculateRetryDelay(requestAttempt)
        await new Promise(resolve => setTimeout(resolve, delay))
        // clear current connection state to force reconnection
        if (clientSocket) {
          clientSocket.destroy()
          clientSocket = undefined
        }
        currentConnectPromise = undefined
      }
    }
  }

  throw lastError || new Error('Request failed after all retry attempts')
}

export const viteNodeFetch: ViteNodeFetch = {
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

// attempt to pre-establish the IPC connection to reduce latency on first request
let preConnectAttempted = false
function preConnect () {
  if (preConnectAttempted || !viteNodeOptions.socketPath) {
    return
  }
  preConnectAttempted = true

  return connectSocket().catch(() => {})
}

if (typeof process !== 'undefined' && !isTest) {
  setTimeout(preConnect, 100)
}
