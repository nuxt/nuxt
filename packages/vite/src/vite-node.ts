import { mkdir, unlink, writeFile } from 'node:fs/promises'
import type { Socket } from 'node:net'
import net from 'node:net'
import os from 'node:os'
import fs from 'node:fs' // For sync operations like unlinkSync if needed during setup
import { pathToFileURL } from 'node:url'
import { Buffer } from 'node:buffer'
import { createError } from 'h3'
import { ViteNodeServer } from 'vite-node/server'
import { join, normalize, resolve } from 'pathe'
import type { ModuleNode, ViteDevServer, Plugin as VitePlugin } from 'vite'
import { getQuery } from 'ufo'
import { normalizeViteManifest } from 'vue-bundle-renderer'
import type { Manifest } from 'vue-bundle-renderer'
import type { FetchResult, ViteNodeResolveId } from 'vite-node'

import { distDir } from './dirs'
import type { ViteBuildContext } from './vite'
import { isCSS } from './utils'

export interface ViteNodeRequestMap {
  manifest: {
    request: void
    response: Manifest
  }
  invalidates: {
    request: void
    response: string[]
  }
  resolve: {
    request: { id: string, importer?: string }
    response: ViteNodeResolveId | null
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
  resolveId(id: string, importer?: string): Promise<ViteNodeResolveId | null>
  /** Fetches a module. */
  fetchModule(moduleId: string): Promise<FetchResult>
  /** Ensures the IPC socket is connected. */
  ensureConnected(): Promise<Socket>
}

function getManifest (ctx: ViteBuildContext): Manifest {
  const css = new Set<string>()
  if (ctx.ssrServer) {
    for (const key of ctx.ssrServer.moduleGraph.urlToModuleMap.keys()) {
      if (isCSS(key)) {
        const query = getQuery(key)
        if ('raw' in query) { continue }
        const importers = ctx.ssrServer.moduleGraph.urlToModuleMap.get(key)?.importers
        if (importers && [...importers].every(i => i.id && 'raw' in getQuery(i.id))) {
          continue
        }
        css.add(key)
      }
    }
  }

  const manifest = normalizeViteManifest({
    '@vite/client': {
      file: '@vite/client',
      css: [...css],
      module: true,
      isEntry: true,
    },
    ...ctx.nuxt.options.features.noScripts === 'all'
      ? {}
      : {
          [ctx.entry]: {
            file: ctx.entry,
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
    if (nodeMajor >= 20) {
      return `\0${socketName}.sock`
    }
  }
  // Unix socket
  return join(os.tmpdir(), `${socketName}.sock`)
}

export function ViteNodePlugin (ctx: ViteBuildContext): VitePlugin {
  const invalidates = new Set<string>()
  let socketServer: net.Server | undefined
  let socketPath: string | undefined
  let viteNodeServerOptions: ViteNodeServerOptions | undefined

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

  function initializeViteNodeConfig () {
    if (viteNodeServerOptions) {
      return viteNodeServerOptions // Already initialized
    }

    const generatedSocketPath = generateSocketPath()

    viteNodeServerOptions = {
      socketPath: generatedSocketPath,
      root: ctx.nuxt.options.srcDir,
      entryPath: ctx.entry,
      base: ctx.config.base || '/_nuxt/',
    }

    // Set the environment variable for the client-side (vite-node-shared.mjs)
    process.env.NUXT_VITE_NODE_OPTIONS = JSON.stringify(viteNodeServerOptions)

    return viteNodeServerOptions
  }

  function setupSocket (server: ViteDevServer) {
    if (socketServer) {
      return // Socket already created
    }

    const config = initializeViteNodeConfig()
    socketPath = config.socketPath
    socketServer = createViteNodeSocketServer(ctx, invalidates, config)

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

    server.httpServer?.on('close', cleanupSocket)
  }

  return {
    name: 'nuxt:vite-node-server',
    enforce: 'post',
    configureServer (server) {
      // Try to set up the socket immediately
      setupSocket(server)

      ctx.nuxt.hook('app:templatesGenerated', (_app, changedTemplates) => {
        for (const template of changedTemplates) {
          const mods = server.moduleGraph.getModulesByFile(`virtual:nuxt:${encodeURIComponent(template.dst)}`)
          for (const mod of mods || []) {
            markInvalidate(mod)
          }
        }
      })

      server.watcher.on('all', (_event, file) => {
        invalidates.add(file)
        markInvalidates(server.moduleGraph.getModulesByFile(normalize(file)))
      })
    },
    buildStart () {
      // Try to set up the socket again in case it wasn't set up during configureServer
      // This ensures socket creation when needed
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

function createViteNodeSocketServer (ctx: ViteBuildContext, invalidates: Set<string>, config: ViteNodeServerOptions) {
  let _node: ViteNodeServer | undefined
  function getNode (viteDevServer: ViteDevServer) {
    return _node ||= new ViteNodeServer(viteDevServer, {
      deps: {
        inline: [/^#/, /\?/],
      },
      transformMode: {
        ssr: [/.*/],
        web: [],
      },
    })
  }

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
            const manifestData = getManifest(ctx)
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
            if (!resolveId || !ctx.ssrServer) {
              throw createError({ statusCode: 400, message: 'Missing id for resolve' })
            }
            const resolvedResult = await getNode(ctx.ssrServer).resolveId(resolveId, importer).catch(() => null)
            sendResponse<'resolve'>(socket, requestId, resolvedResult)
            return
          }
          case 'module': {
            if (payload.moduleId === '/' || !ctx.ssrServer) {
              throw createError({ statusCode: 400, message: 'Invalid moduleId' })
            }
            const node = getNode(ctx.ssrServer)
            const response = await node.fetchModule(payload.moduleId).catch(async (err) => {
              const errorData: Record<string, any> = {
                code: 'VITE_ERROR',
                id: payload.moduleId,
                stack: err.stack || '',
                message: err.message || '',
              }
              if (err.frame) { errorData.frame = err.frame }

              if (!errorData.frame && err.code === 'PARSE_ERROR') {
                try {
                  const transformed = await node.transformModule(payload.moduleId, 'web')
                  errorData.frame = `${err.message || ''}\\n${transformed.code}`
                } catch {
                  // Ignore transform errors
                }
              }
              throw createError({ data: errorData, message: err.message || 'Error fetching module' })
            })
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
): void {
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
  socketPath: string
  root: string
  entryPath: string
  base: string
}

export async function initViteNodeServer (ctx: ViteBuildContext) {
  const serverResolvedPath = resolve(distDir, 'runtime/vite-node.mjs')
  const manifestResolvedPath = resolve(distDir, 'runtime/client.manifest.mjs')

  await mkdir(join(ctx.nuxt.options.buildDir, 'dist/server'), { recursive: true })

  await writeFile(
    resolve(ctx.nuxt.options.buildDir, 'dist/server/server.mjs'),
    `export { default } from ${JSON.stringify(pathToFileURL(serverResolvedPath).href)}`,
  )
  await writeFile(
    resolve(ctx.nuxt.options.buildDir, 'dist/server/client.manifest.mjs'),
    `export { default } from ${JSON.stringify(pathToFileURL(manifestResolvedPath).href)}`,
  )
}
