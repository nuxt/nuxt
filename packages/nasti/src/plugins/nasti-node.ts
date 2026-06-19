import process from 'node:process'
import { rm } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { win32 as pathWin32 } from 'node:path'
import { dirname, isAbsolute, join } from 'pathe'
import { directoryToURL, resolveAlias, tryUseNuxt, useNitro } from '@nuxt/kit'
import { resolveModulePath } from 'exsolve'
import { normalizeViteManifest } from 'vue-bundle-renderer'
import type { Manifest } from 'vue-bundle-renderer'
import type { Nuxt } from '@nuxt/schema'
import type { DevServer, NastiEnvironment } from '@nasti-toolchain/nasti'

// `ResolveIdResult` is declared but not exported by Nasti; mirror its shape locally.
type ResolveIdResult = string | null | undefined | { id: string, external?: boolean }

// ---- Shared protocol (imported by the `#nasti-node` client) -----------------

/** Module fetch payload the Nitro-side runner evaluates. */
export interface NastiFetchResult {
  id?: string
  file?: string
  code?: string
  /** When set, the runner should `import()` this id natively instead of evaluating code. */
  externalize?: string
  map?: unknown
}

export interface NastiNodeRequestMap {
  manifest: { request: undefined, response: Manifest }
  invalidates: { request: undefined, response: string[] }
  resolve: { request: { id: string, importer?: string }, response: ResolveIdResult | null }
  module: { request: { moduleId: string }, response: NastiFetchResult }
}

type RequestOf = {
  [K in keyof NastiNodeRequestMap]: { id: number, type: K, payload: NastiNodeRequestMap[K]['request'] }
}
type NastiNodeRequest = RequestOf[keyof RequestOf]

export interface NastiNodeFetch {
  getManifest(): Promise<Manifest>
  getInvalidates(): Promise<string[]>
  resolveId(id: string, importer?: string): Promise<ResolveIdResult | null>
  fetchModule(moduleId: string): Promise<NastiFetchResult>
  ensureConnected(): Promise<net.Socket>
}

export interface NastiNodeServerOptions {
  baseURL: string
  socketPath: string
  root: string
  entryPath: string
  base: string
  maxRetryAttempts?: number
  baseRetryDelay?: number
  maxRetryDelay?: number
  requestTimeout?: number
}

interface SocketPathInfo {
  socketPath: string
  /** mkdtemp directory we own; cleaned up on close. Undefined for Windows pipes. */
  parentDir?: string
}

// ---- Socket path (Unix mkdtemp / Windows named pipe) ------------------------

export function pickSocketPath (platform: NodeJS.Platform, tmpdir: string = os.tmpdir()): SocketPathInfo {
  const socketName = 'nuxt.sock'
  const socketDir = 'nuxt-nasti-'

  if (platform === 'win32') {
    return { socketPath: pathWin32.join(String.raw`\\.\pipe`, socketDir + randomUUID().slice(0, 8)) }
  }

  let parentDir = fs.mkdtempSync(join(tmpdir, socketDir))
  // macOS's per-user $TMPDIR can exceed the AF_UNIX path limit; fall back to /tmp.
  if (Buffer.byteLength(join(parentDir, socketName)) > (platform === 'linux' ? 108 : 104)) {
    // Discard the too-long mkdtemp dir we just created before switching to /tmp.
    fs.rmSync(parentDir, { recursive: true, force: true })
    parentDir = join('/tmp', socketDir + randomUUID().slice(0, 8))
    fs.mkdirSync(parentDir, { mode: 0o700 })
  }
  fs.chmodSync(parentDir, 0o700)
  return { socketPath: join(parentDir, socketName), parentDir }
}

// ---- Manifest (dev) ---------------------------------------------------------

function getManifest (nuxt: Nuxt, clientEntry: string): Manifest {
  const css = new Set<string>()

  // Global CSS from config, resolved to absolute /@fs paths — prevents FOUC before the
  // SSR module graph is populated.
  for (const globalCss of nuxt.options.css) {
    if (typeof globalCss !== 'string') {
      continue
    }
    let resolved: string | undefined = resolveAlias(globalCss, nuxt.options.alias)
    if (!isAbsolute(resolved)) {
      resolved = resolveModulePath(resolved, {
        try: true,
        from: nuxt.options.modulesDir.map(d => directoryToURL(d)),
      })
      if (!resolved) {
        continue
      }
      css.add('/@fs' + resolved.replace(/^(?!\/)/, '/'))
    } else {
      css.add(resolved)
    }
  }

  return normalizeViteManifest({
    '@nasti/client': {
      file: '@nasti/client',
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
}

// ---- Length-prefixed framing helpers ----------------------------------------

function frame (payload: unknown): Buffer {
  const messageBuffer = Buffer.from(JSON.stringify(payload), 'utf-8')
  const full = Buffer.alloc(4 + messageBuffer.length)
  full.writeUInt32BE(messageBuffer.length, 0)
  messageBuffer.copy(full, 4)
  return full
}

function sendResponse (socket: net.Socket, id: number, data: unknown) {
  socket.write(frame({ id, type: 'response', data }), () => {})
}

function sendError (socket: net.Socket, id: number, error: any) {
  socket.write(frame({
    id,
    type: 'error',
    error: { message: error?.message, stack: error?.stack, status: error?.status, data: error?.data },
  }), () => {})
}

/**
 * Dev-only IPC bridge between the Nuxt/Nasti process (which owns the SSR module graph) and
 * the Nitro process (which renders). Mirrors `@nuxt/vite-builder`'s vite-node plugin.
 *
 * Caveat: Nasti does not expose its SSR `ModuleRunner` publicly, so the `module` handler
 * returns code via `server.transformRequest` and the Nitro-side runner evaluates it. The
 * exact transform shape Nasti's runner expects may need validation against a running app —
 * this is the remaining dev-SSR (M2) integration point.
 */
export function NastiNodePlugin (nuxt: Nuxt): NastiPluginLike | undefined {
  if (!nuxt.options.dev) {
    return
  }

  let socketServer: net.Server | undefined
  const { socketPath, parentDir } = pickSocketPath(process.platform)
  const invalidates = new Set<string>()

  let cleanedUp = false
  async function cleanupSocket () {
    if (cleanedUp) {
      return
    }
    cleanedUp = true
    if (socketServer?.listening) {
      await new Promise<void>(res => socketServer!.close(() => res()))
    }
    if (parentDir) {
      await rm(parentDir, { recursive: true, force: true }).catch(() => {})
    }
  }

  const nitro = useNitro()

  const runnerPath = resolveModulePath('#nasti-node-runner', { from: import.meta.url })
  const entryPath = resolveModulePath('#nasti-node-entry', { from: import.meta.url })
  const fetchPath = resolveModulePath('#nasti-node', { from: import.meta.url })

  const vfs = {
    'server.mjs': `export { default } from ${JSON.stringify(pathToFileURL(entryPath).href)}`,
    'runner.mjs': `export { default } from ${JSON.stringify(pathToFileURL(runnerPath).href)}`,
    // dev IPC variant of the client manifest — fetched live over the socket.
    'client.manifest.mjs': `import { nastiNodeFetch } from ${JSON.stringify(pathToFileURL(fetchPath).href)};export default () => nastiNodeFetch.getManifest()`,
  }
  nitro.options.virtual ||= {}
  nitro.options._config.virtual ||= {}
  for (const name in vfs) {
    const filename = `#build/dist/server/${name}`
    nitro.options.virtual[filename] = vfs[name as keyof typeof vfs]
    nitro.options._config.virtual[filename] = vfs[name as keyof typeof vfs]
  }

  return {
    name: 'nuxt:nasti:node-server',
    enforce: 'post',
    configureServer (server: DevServer) {
      if (!tryUseNuxt()) {
        return
      }

      const ssrEnv = server.environments.ssr as NastiEnvironment | undefined
      const clientEnv = server.environments.client as NastiEnvironment | undefined

      const clientEntry = nuxt.apps.default?.mainComponent || nuxt.options.appDir

      const options: NastiNodeServerOptions = {
        socketPath,
        root: nuxt.options.srcDir,
        entryPath: ssrEnv?.options.entry[0] ?? '',
        base: '/',
        maxRetryAttempts: nuxt.options.vite.viteNode?.maxRetryAttempts,
        baseRetryDelay: nuxt.options.vite.viteNode?.baseRetryDelay,
        maxRetryDelay: nuxt.options.vite.viteNode?.maxRetryDelay,
        requestTimeout: nuxt.options.vite.viteNode?.requestTimeout,
        baseURL: nuxt.options.devServer.url,
      }
      process.env.NUXT_NASTI_NODE_OPTIONS = JSON.stringify(options)

      socketServer = createSocketServer(socketPath, async (request, socket) => {
        switch (request.type) {
          case 'manifest': {
            sendResponse(socket, request.id, getManifest(nuxt, clientEntry))
            return
          }
          case 'invalidates': {
            const payload = [...invalidates]
            invalidates.clear()
            sendResponse(socket, request.id, payload)
            return
          }
          case 'resolve': {
            const { id, importer } = request.payload
            const resolved = await ssrEnv?.pluginContainer?.resolveId(id, importer).catch(() => null)
            sendResponse(socket, request.id, resolved ?? null)
            return
          }
          case 'module': {
            const { moduleId } = request.payload
            if (!moduleId || moduleId === '/') {
              throw Object.assign(new Error('Invalid moduleId'), { status: 400 })
            }
            // Nasti has no public SSR `fetchModule`; transform on demand. The runner then
            // evaluates the returned code.
            const result = await server.transformRequest(moduleId)
            const code = typeof result === 'string' ? result : (result?.code ?? '')
            const map = typeof result === 'string' ? undefined : result?.map
            sendResponse(socket, request.id, { id: moduleId, code, map } satisfies NastiFetchResult)
            return
          }
        }
      })

      nuxt.hook('close', cleanupSocket)

      // Track invalidated modules so the runner can drop stale SSR cache entries.
      nuxt.hook('app:templatesGenerated', (_app, changedTemplates) => {
        const graph = clientEnv?.moduleGraph
        for (const template of changedTemplates) {
          invalidates.add(template.dst)
          for (const mod of graph?.getModulesByFile(template.dst) ?? []) {
            if (mod.id) {
              invalidates.add(mod.id)
            }
          }
        }
      })
    },
    async buildEnd () {
      await cleanupSocket()
    },
  }
}

// `NastiPlugin` typed loosely here to avoid over-constraining the `this` of buildEnd; the
// returned object is a structurally-valid NastiPlugin (registered in `nasti.ts`).
type NastiPluginLike = import('@nasti-toolchain/nasti').NastiPlugin

function createSocketServer (socketPath: string, onRequest: (request: NastiNodeRequest, socket: net.Socket) => Promise<void>): net.Server {
  const server = net.createServer((socket) => {
    let buffer = Buffer.alloc(64 * 1024)
    let writeOffset = 0
    let readOffset = 0
    socket.setNoDelay(true)

    socket.on('data', (data) => {
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
        let request: NastiNodeRequest | undefined
        try {
          request = JSON.parse(json)
        } catch {
          continue
        }
        if (request) {
          onRequest(request, socket).catch(error => sendError(socket, request!.id, error))
        }
      }

      if (readOffset > 0) {
        buffer.copy(buffer, 0, readOffset, writeOffset)
        writeOffset -= readOffset
        readOffset = 0
      }
    })
    socket.on('error', () => {})
  })

  listenAndRestrict(server, socketPath)
  server.on('error', () => {})
  return server
}

export function listenAndRestrict (server: net.Server, socketPath: string): void {
  if (socketPath.startsWith('\\\\.\\pipe\\')) {
    server.listen(socketPath)
    return
  }
  const previousUmask = process.umask(0o077)
  try {
    server.listen(socketPath, () => {
      try {
        fs.chmodSync(socketPath, 0o600)
      } catch (error) {
        console.error('[nasti-builder] Failed to restrict node socket permissions; closing.', error)
        server.close()
        fs.rmSync(dirname(socketPath), { recursive: true, force: true })
      }
    })
  } finally {
    process.umask(previousUmask)
  }
}
