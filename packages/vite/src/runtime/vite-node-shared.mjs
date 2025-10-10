// @ts-check
import net from 'node:net'
import { Buffer } from 'node:buffer'
import { isTest } from 'std-env'

/** @typedef {import('node:net').Socket} Socket */
/** @typedef {import('../plugins/vite-node').ViteNodeFetch} ViteNodeFetch */

/** @type {import('../plugins/vite-node').ViteNodeServerOptions} */
export const viteNodeOptions = JSON.parse(process.env.NUXT_VITE_NODE_OPTIONS || '{}')

/** @type {Map<number, { resolve: (value: any) => void, reject: (reason?: any) => void }>} */
const pendingRequests = new Map()
let requestIdCounter = 0
/** @type {Socket | undefined} */
let clientSocket
/** @type {Promise<Socket> | undefined} */
let currentConnectPromise
const MAX_RETRY_ATTEMPTS = viteNodeOptions.maxRetryAttempts ?? 5
const BASE_RETRY_DELAY_MS = viteNodeOptions.baseRetryDelay ?? 100
const MAX_RETRY_DELAY_MS = viteNodeOptions.maxRetryDelay ?? 2000
const REQUEST_TIMEOUT_MS = viteNodeOptions.requestTimeout ?? 60000

/**
 * Calculates exponential backoff delay with jitter.
 * @param {number} attempt - The current attempt number (0-based).
 * @returns {number} Delay in milliseconds.
 */
function calculateRetryDelay (attempt) {
  const exponentialDelay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt)
  const jitter = Math.random() * 0.1 * exponentialDelay // Add 10% jitter
  return Math.min(exponentialDelay + jitter, MAX_RETRY_DELAY_MS)
}

/**
 * Establishes or returns an existing IPC socket connection with retry logic.
 * @returns {Promise<Socket>} A promise that resolves with the connected socket.
 */
function connectSocket () {
  if (clientSocket && !clientSocket.destroyed) {
    return Promise.resolve(clientSocket)
  }

  if (currentConnectPromise) {
    return currentConnectPromise
  }

  const thisPromise = new Promise((resolve, reject) => {
    if (!viteNodeOptions.socketPath) {
      console.error('vite-node-shared: NUXT_VITE_NODE_OPTIONS.socketPath is not defined.')
      return reject(new Error('Vite Node IPC socket path not configured.'))
    }

    const attemptConnection = (attempt = 0) => {
      const socket = net.createConnection(viteNodeOptions.socketPath)

      const INITIAL_BUFFER_SIZE = 64 * 1024 // 64KB
      const MAX_BUFFER_SIZE = 1024 * 1024 * 1024 // 1GB

      let buffer = Buffer.alloc(INITIAL_BUFFER_SIZE)
      let writeOffset = 0
      let readOffset = 0

      // optimize socket for high-frequency IPC
      socket.setNoDelay(true)
      socket.setKeepAlive(true, 30000) // 30s

      const cleanup = () => {
        socket.off('connect', onConnect)
        socket.off('data', onData)
        socket.off('error', onError)
        socket.off('close', onClose)
      }

      const resetBuffer = () => {
        writeOffset = 0
        readOffset = 0
      }

      const compactBuffer = () => {
        if (readOffset > 0) {
          const remainingData = writeOffset - readOffset
          if (remainingData > 0) {
            buffer.copy(buffer, 0, readOffset, writeOffset)
          }
          writeOffset = remainingData
          readOffset = 0
        }
      }

      /**
       * @param {number} additionalBytes
       */
      const ensureBufferCapacity = (additionalBytes) => {
        const requiredSize = writeOffset + additionalBytes

        if (requiredSize > MAX_BUFFER_SIZE) {
          throw new Error(`Buffer size limit exceeded: ${requiredSize} > ${MAX_BUFFER_SIZE}`)
        }

        if (requiredSize > buffer.length) {
          // Try compacting first
          compactBuffer()

          // ... then if we still need more space, grow the buffer
          if (writeOffset + additionalBytes > buffer.length) {
            const newSize = Math.min(
              Math.max(buffer.length * 2, requiredSize),
              MAX_BUFFER_SIZE,
            )
            const newBuffer = Buffer.alloc(newSize)
            buffer.copy(newBuffer, 0, 0, writeOffset)
            buffer = newBuffer
          }
        }
      }

      const onConnect = () => {
        clientSocket = socket
        resolve(socket)
      }

      /** @param {Buffer} data */
      const onData = (data) => {
        try {
          ensureBufferCapacity(data.length)
          data.copy(buffer, writeOffset)
          writeOffset += data.length

          while (writeOffset - readOffset >= 4) {
            const messageLength = buffer.readUInt32BE(readOffset)

            if (writeOffset - readOffset < 4 + messageLength) {
              return // Wait for more data
            }

            const message = buffer.subarray(readOffset + 4, readOffset + 4 + messageLength).toString('utf-8')
            readOffset += 4 + messageLength

            try {
              const response = JSON.parse(message)
              const requestHandlers = pendingRequests.get(response.id)
              if (requestHandlers) {
                const { resolve: resolveRequest, reject: rejectRequest } = requestHandlers
                if (response.type === 'error') {
                  const err = new Error(response.error.message)
                  // @ts-ignore We are augmenting the error object
                  err.stack = response.error.stack
                  // @ts-ignore
                  err.data = response.error.data
                  // @ts-ignore
                  err.statusCode = response.error.statusCode
                  rejectRequest(err)
                } else {
                  resolveRequest(response.data)
                }
                pendingRequests.delete(response.id)
              }
            } catch (parseError) {
              console.warn('vite-node-shared: Failed to parse IPC response:', parseError)
              // ignore malformed messages
            }
          }

          // compact buffer periodically to prevent memory waste
          if (readOffset > buffer.length / 2) {
            compactBuffer()
          }
        } catch (error) {
          socket.destroy(error instanceof Error ? error : new Error('Buffer management error'))
        }
      }

      /** @param {Error} err */
      const onError = (err) => {
        cleanup()
        resetBuffer()

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
        resetBuffer()
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
 * @template {keyof import('../plugins/vite-node').ViteNodeRequestMap} T
 * @param {T} type - The type of the request.
 * @param {import('../plugins/vite-node').ViteNodeRequestMap[T]['request']} [payload] - The payload for the request.
 * @returns {Promise<import('../plugins/vite-node').ViteNodeRequestMap[T]['response']>} A promise that resolves with the response data.
 */
async function sendRequest (type, payload) {
  const requestId = requestIdCounter++
  let lastError

  // retry the entire request (including reconnection) up to MAX_RETRY_ATTEMPTS times
  for (let requestAttempt = 0; requestAttempt <= MAX_RETRY_ATTEMPTS; requestAttempt++) {
    try {
      const socket = await connectSocket()

      return new Promise((resolve, reject) => {
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

        const message = JSON.stringify({ id: requestId, type, payload })
        const messageBuffer = Buffer.from(message, 'utf-8')
        const messageLength = messageBuffer.length

        // pre-allocate single buffer for length + message to avoid Buffer.concat()
        const fullMessage = Buffer.alloc(4 + messageLength)
        fullMessage.writeUInt32BE(messageLength, 0)
        messageBuffer.copy(fullMessage, 4)

        try {
          socket.write(fullMessage)
        } catch (error) {
          clearTimeout(timeoutId)
          pendingRequests.delete(requestId)
          reject(error)
        }
      })
    } catch (error) {
      lastError = error
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

/**
 * @type {ViteNodeFetch}
 */
export const viteNodeFetch = {
  getManifest () {
    return sendRequest('manifest')
  },
  getInvalidates () {
    return sendRequest('invalidates')
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
