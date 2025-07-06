import { mkdir, unlink, writeFile } from 'node:fs/promises'
import type { Socket } from 'node:net'
import net from 'node:net'
import os from 'node:os'
import fs from 'node:fs' // For sync operations like unlinkSync if needed during setup
import { pathToFileURL } from 'node:url'
import { Buffer } from 'node:buffer'
import { createError } from 'h3'
import { join, normalize, resolve } from 'pathe'
import type { ModuleNode, PluginContainer, ViteDevServer, Plugin as VitePlugin } from 'vite'
import { getQuery } from 'ufo'
import type { FetchResult } from 'vite-node'
import { normalizeViteManifest } from 'vue-bundle-renderer'
import type { Manifest } from 'vue-bundle-renderer'
import type { Nuxt } from '@nuxt/schema'
import { provider } from 'std-env'

import { distDir } from './dirs'
import { isCSS } from './utils'
import { resolveClientEntry, resolveServerEntry } from './utils/config'

type ResolveIdResponse = Awaited<ReturnType<PluginContainer['resolveId']>>

export interface ViteNodeRequestMap {
  manifest: {
    request: undefined
    response: Manifest
  }
  invalidates: {
    request: undefined
    response: string[]
  }
  resolve: {
    request: { id: string, importer?: string }
    response: ResolveIdResponse | null
  }
  module: {
    request: { moduleId: string }
    response: FetchResult
  }
}

export interface ViteNodeFetch {
  /**  Gets the client manifest. */
  getManifest(): Promise<Manifest>
  /** Gets the list of invalidated files. */
  getInvalidates(): Promise<string[]>
  /** Resolves a module ID. */
  resolveId(id: string, importer?: string): Promise<ResolveIdResponse | null>
  /** Fetches a module. */
  fetchModule(moduleId: string): Promise<FetchResult>
  /** Ensures the IPC socket is connected. */
  ensureConnected(): Promise<Socket>
}

function getManifest (nuxt: Nuxt, ssrServer: ViteDevServer, clientEntry: string) {
  const css = new Set<string>()
  for (const key of ssrServer.moduleGraph.urlToModuleMap.keys()) {
    if (isCSS(key)) {
      const query = getQuery(key)
      if ('raw' in query) { continue }
      const importers = ssrServer.moduleGraph.urlToModuleMap.get(key)?.importers
      if (importers && [...importers].every(i => i.id && 'raw' in getQuery(i.id))) {
        continue
      }
      css.add(key)
    }
  }

  const manifest = normalizeViteManifest({
    '@vite/client': {
      file: '@vite/client',
      css: [...css],
      module: true,
      isEntry: true,
    },
    ...nuxt.options.features.noScripts === 'all'
      ? {}
      : {
          [clientEntry]: {
            file: clientEntry,
            isEntry: true,
            module: true,
            resourceType: 'script',
          },
        },
  })

  return manifest
}

function generateSocketPath () {
  const uniqueSuffix = `${process.pid}-${Date.now()}`
  const socketName = `nuxt-vite-node-${uniqueSuffix}`

  // Windows: pipe
  if (process.platform === 'win32') {
    return join(String.raw`\\.\pipe`, socketName)
  }
  // Linux: abstract namespace
  if (process.platform === 'linux') {
    const nodeMajor = Number.parseInt(process.versions.node.split('.')[0]!, 10)
    if (nodeMajor >= 20 && provider !== 'stackblitz') {
      // We avoid abstract sockets in Docker due to performance issues
      let isDocker = false

      try {
        isDocker = fs.existsSync('/.dockerenv') || (fs.existsSync('/proc/1/cgroup') && fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker'))
      } catch {
        // Ignore errors checking Docker status
      }

      if (!isDocker) {
        return `\0${socketName}.sock`
      }
    }
  }
  // Unix socket
  return join(os.tmpdir(), `${socketName}.sock`)
}

function useInvalidates () {
  // Store the invalidates for the next rendering
  const invalidates = new Set<string>()

  function markInvalidate (mod: ModuleNode) {
    if (!mod.id) { return }
    if (invalidates.has(mod.id)) { return }
    invalidates.add(mod.id)
    markInvalidates(mod.importers)
  }

  function markInvalidates (mods?: ModuleNode[] | Set<ModuleNode>) {
    if (!mods) { return }
    for (const mod of mods) {
      markInvalidate(mod)
    }
  }

  return {
    invalidates,
    markInvalidate,
    markInvalidates,
  }
}

export function ViteNodePlugin (nuxt: Nuxt): VitePlugin {
  let socketServer: net.Server | undefined
  const socketPath = generateSocketPath()
  let viteNodeServerOptions: ViteNodeServerOptions | undefined

  const { invalidates, markInvalidate, markInvalidates } = useInvalidates()

  const cleanupSocket = async () => {
    if (socketServer && socketServer.listening) {
      await new Promise<void>(resolveClose => socketServer!.close(() => resolveClose()))
    }
    if (socketPath && !socketPath.startsWith('\\\\.\\pipe\\')) {
      try {
        await unlink(socketPath)
      } catch {
      // Error is ignored if the file doesn't exist or cannot be unlinked
      }
    }
  }

  return {
    name: 'nuxt:vite-node-server',
    enforce: 'post',
    applyToEnvironment: environment => environment.name === 'client',
    configureServer (clientServer) {
      nuxt.hook('vite:serverCreated', (ssrServer, ctx) => {
        if (!ctx.isServer) {
          return
        }

        viteNodeServerOptions = {
          socketPath,
          root: nuxt.options.srcDir,
          entryPath: resolveServerEntry(ssrServer.config),
          base: ssrServer.config.base || '/_nuxt/',
          // TODO: remove baseURL in future
          baseURL: nuxt.options.devServer.url,
        }

        process.env.NUXT_VITE_NODE_OPTIONS = JSON.stringify(viteNodeServerOptions)

        socketServer = createViteNodeSocketServer(nuxt, ssrServer, clientServer, invalidates, viteNodeServerOptions)
      })
      nuxt.hook('close', cleanupSocket)

      nuxt.hook('app:templatesGenerated', (_app, changedTemplates) => {
        for (const template of changedTemplates) {
          const mods = clientServer.moduleGraph.getModulesByFile(`virtual:nuxt:${encodeURIComponent(template.dst)}`)
          for (const mod of mods || []) {
            markInvalidate(mod)
          }
        }
      })

      clientServer.watcher.on('all', (_event, file) => {
        invalidates.add(file)
        markInvalidates(clientServer.moduleGraph.getModulesByFile(normalize(file)))
      })
    },
    async buildEnd () {
      if (socketServer && socketServer.listening) {
        await new Promise<void>(resolveClose => socketServer!.close(() => resolveClose()))
      }
      if (socketPath && !socketPath.startsWith('\\\\.\\pipe\\')) {
        try {
          await unlink(socketPath)
        } catch {
          // Error is ignored if the file doesn't exist or cannot be unlinked
        }
      }
    },
  }
}

function createViteNodeSocketServer (nuxt: Nuxt, ssrServer: ViteDevServer, clientServer: ViteDevServer, invalidates: Set<string>, config: ViteNodeServerOptions) {
  const server = net.createServer((socket) => {
    const INITIAL_BUFFER_SIZE = 64 * 1024 // 64kB
    const MAX_BUFFER_SIZE = 1024 * 1024 * 1024 // 1GB

    let buffer = Buffer.alloc(INITIAL_BUFFER_SIZE)
    let writeOffset = 0
    let readOffset = 0

    // Optimize socket settings for performance
    socket.setNoDelay(true)
    socket.setKeepAlive(true, 0)

    const processMessage = async (request: any) => {
      const { id: requestId, type, payload } = request

      try {
        switch (type) {
          case 'manifest': {
            const manifestData = getManifest(nuxt, ssrServer, resolveClientEntry(clientServer.config))
            sendResponse<'manifest'>(socket, requestId, manifestData)
            return
          }
          case 'invalidates': {
            const responsePayload = Array.from(invalidates)
            invalidates.clear()
            sendResponse<'invalidates'>(socket, requestId, responsePayload)
            return
          }
          case 'resolve': {
            const { id: resolveId, importer } = payload
            if (!resolveId || !ssrServer) {
              throw createError({ statusCode: 400, message: 'Missing id for resolve' })
            }
            const resolvedResult = await ssrServer.pluginContainer.resolveId(resolveId, importer).catch(() => null)
            sendResponse<'resolve'>(socket, requestId, resolvedResult)
            return
          }
          case 'module': {
            if (payload.moduleId === '/' || !ssrServer) {
              throw createError({ statusCode: 400, message: 'Invalid moduleId' })
            }
            const response = await ssrServer.environments.ssr.fetchModule(payload.moduleId)
              .catch(async (err) => {
                const errorData: Record<string, any> = {
                  code: 'VITE_ERROR',
                  id: payload.moduleId,
                  stack: err.stack || '',
                  message: err.message || '',
                }
                if (err.frame) { errorData.frame = err.frame }

                if (!errorData.frame && err.code === 'PARSE_ERROR') {
                  try {
                    errorData.frame = await clientServer.transformRequest(payload.moduleId)
                      .then(res => `${err.message || ''}\n${res?.code}`).catch(() => undefined)
                  } catch {
                  // Ignore transform errors
                  }
                }
                throw createError({ data: errorData, message: err.message || 'Error fetching module' })
              }) as Exclude<FetchResult, { cache: true }>
            sendResponse<'module'>(socket, requestId, response)
            return
          }
          default:
            throw createError({ statusCode: 400, message: `Unknown request type: ${type}` })
        }
      } catch (error: any) {
        sendError(socket, requestId, error)
      }
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

    const ensureBufferCapacity = (additionalBytes: number) => {
      const requiredSize = writeOffset + additionalBytes

      if (requiredSize > MAX_BUFFER_SIZE) {
        throw new Error(`Buffer size limit exceeded: ${requiredSize} > ${MAX_BUFFER_SIZE}`)
      }

      if (requiredSize > buffer.length) {
        // try compacting first
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

    socket.on('data', (data) => {
      try {
        ensureBufferCapacity(data.length)
        data.copy(buffer, writeOffset)
        writeOffset += data.length

        // Process all complete messages in the buffer
        while (writeOffset - readOffset >= 4) {
          const messageLength = buffer.readUInt32BE(readOffset)
          const totalLength = 4 + messageLength

          if (writeOffset - readOffset < totalLength) {
            break // Wait for more data
          }

          const messageJSON = buffer.subarray(readOffset + 4, readOffset + totalLength).toString('utf-8')
          readOffset += totalLength

          try {
            const request = JSON.parse(messageJSON)
            processMessage(request).catch((error) => {
              sendError(socket, request?.id || 'unknown', error)
            })
          } catch (parseError) {
            // invalid JSON
            const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error'
            socket.destroy(new Error(`Invalid JSON in message: ${errorMessage}`))
            return
          }
        }

        // compact buffer periodically to prevent memory waste
        if (readOffset > buffer.length / 2) {
          compactBuffer()
        }
      } catch (error) {
        // buffer management error - close connection
        socket.destroy(error instanceof Error ? error : new Error('Buffer management error'))
      }
    })

    socket.on('error', () => {
      resetBuffer()
    })

    socket.on('close', () => {
      resetBuffer()
    })
  })

  const currentSocketPath = config.socketPath
  if (!currentSocketPath) {
    throw new Error('Socket path not configured for ViteNodeSocketServer.')
  }

  // Clean up existing socket file (Unix only)
  if (!currentSocketPath.startsWith('\\\\.\\pipe\\')) {
    try {
      fs.unlinkSync(currentSocketPath)
    } catch (unlinkError: any) {
      if (unlinkError.code !== 'ENOENT') {
        // Socket cleanup failed, but continue anyway
      }
    }
  }

  server.listen(currentSocketPath)

  server.on('error', () => {
    // Server error - will be handled by calling code
  })

  return server
}

function sendResponse<T extends keyof ViteNodeRequestMap> (
  socket: net.Socket,
  id: string,
  data: ViteNodeRequestMap[T]['response'],
): undefined {
  try {
    const response = { id, type: 'response', data }
    const responseJSON = JSON.stringify(response)
    const messageBuffer = Buffer.from(responseJSON, 'utf-8')
    const messageLength = messageBuffer.length

    // pre-allocate single buffer for length + message to avoid Buffer.concat()
    const fullMessage = Buffer.alloc(4 + messageLength)
    fullMessage.writeUInt32BE(messageLength, 0)
    messageBuffer.copy(fullMessage, 4)

    socket.write(fullMessage, (err) => {
      if (err) {
        // Failed to send response - connection likely closed
      }
    })
  } catch (error) {
    // Send error response instead
    sendError(socket, id, error)
  }
}

function sendError (socket: net.Socket, id: string, error: any) {
  const errorResponse = {
    id,
    type: 'error',
    error: {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
      statusMessage: error.statusMessage,
      data: error.data,
    },
  }
  const responseJSON = JSON.stringify(errorResponse)
  const messageBuffer = Buffer.from(responseJSON, 'utf-8')
  const messageLength = messageBuffer.length

  // Pre-allocate single buffer for length + message to avoid Buffer.concat()
  const fullMessage = Buffer.alloc(4 + messageLength)
  fullMessage.writeUInt32BE(messageLength, 0)
  messageBuffer.copy(fullMessage, 4)

  socket.write(fullMessage, (err) => {
    if (err) {
      // Failed to send error response - connection likely closed
    }
  })
}

export type ViteNodeServerOptions = {
  baseURL: string
  socketPath: string
  root: string
  entryPath: string
  base: string
}

export async function writeDevServer (nuxt: Nuxt) {
  const serverResolvedPath = resolve(distDir, 'runtime/vite-node.mjs')
  const manifestResolvedPath = resolve(distDir, 'runtime/client.manifest.mjs')

  await mkdir(join(nuxt.options.buildDir, 'dist/server'), { recursive: true })

  const island = resolve(distDir, 'runtime/island.mjs')

  await Promise.all([
    writeFile(
      resolve(nuxt.options.buildDir, 'dist/server/server.mjs'),
      `export * from ${JSON.stringify(pathToFileURL(serverResolvedPath).href)}; export { default } from ${JSON.stringify(pathToFileURL(serverResolvedPath).href)}`,
    ),
    writeFile(
      resolve(nuxt.options.buildDir, 'dist/server/client.manifest.mjs'),
      `export { default } from ${JSON.stringify(pathToFileURL(manifestResolvedPath).href)}`,
    ),
    writeFile(
      resolve(nuxt.options.buildDir, 'dist/server/components.islands.mjs'),
      `export { default } from ${JSON.stringify(pathToFileURL(island).href)}`,
    ),
  ])
}
