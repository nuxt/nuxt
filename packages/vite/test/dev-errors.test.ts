import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import { createServer } from 'vite'
import type { ViteDevServer } from 'vite'
import type { ErrorReport } from 'my-bad'
import { DevErrorsDevToolsPlugin, DevErrorsPlugin, DevRequestErrorsPlugin, createDevErrorReporter, isTransformError } from '../src/dev-errors.ts'

const transformError = {
  message: 'Illegal \'/\' in tags.',
  plugin: 'vite:vue',
  id: '/src/app.vue',
  loc: { file: '/src/app.vue', line: 8, column: 4 },
  frame: '6  |    <div\n7  |      Nuxt Playground\n8  |    </div>\n   |      ^\n',
}

function createNuxt () {
  const hooks: Record<string, () => void> = {}
  return {
    options: { rootDir: '/src', app: { baseURL: '/' }, devServer: { errorChannel: '/__nuxt_dev__/error' } },
    hook: (name: string, fn: () => void) => { hooks[name] = fn },
    close: () => hooks.close?.(),
  } as unknown as Nuxt & { close: () => void }
}

/** A stand-in dev server, capturing the messages pushed over hmr. */
function devServer (options: { graph?: unknown } = {}) {
  const send = vi.fn()
  const listeners: Record<string, (data?: any, client?: any) => void> = {}
  const server = {
    config: { base: '/_nuxt/' },
    environments: { client: { hot: { send, on: (event: string, fn: (data?: any, client?: any) => void) => { listeners[event] = fn } }, moduleGraph: options.graph } },
  } as unknown as ViteDevServer

  return { server, send, listeners }
}

function listen () {
  const messages: any[] = []
  const channel = new BroadcastChannel('nuxt:dev:error')
  channel.onmessage = event => messages.push(event.data)
  return { messages, channel }
}

describe('isTransformError', () => {
  it('recognises the shape vite gives its logger and hmr channel', () => {
    expect(isTransformError(transformError)).toBe(true)
    expect(isTransformError({ message: 'boom', loc: { line: 1, column: 1 } })).toBe(true)
    expect(isTransformError(new Error('boom'))).toBe(false)
    expect(isTransformError('boom')).toBe(false)
  })

  it('does not take an error vite caught serving a request for a transform failure', () => {
    expect(isTransformError({ message: 'boom', stack: 'Error: boom', id: undefined, frame: '', plugin: undefined, pluginCode: undefined, loc: undefined })).toBe(false)
  })
})

describe('createDevErrorReporter', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('reports a compile error once, to the channel and the terminal', async () => {
    const nuxt = createNuxt()
    const print = vi.fn()
    const { messages, channel } = listen()
    const reporter = createDevErrorReporter(nuxt, { print })

    const report = await reporter.report(transformError)
    expect(await reporter.report({ ...transformError })).toBeUndefined()

    expect(report).toMatchObject({ kind: 'compile', frames: [{ file: '/src/app.vue', line: 8, column: 4 }] })
    await vi.waitFor(() => expect(messages).toHaveLength(1))
    expect(messages[0]).toEqual({ type: 'nuxt:dev:error:report', report })
    expect(print).toHaveBeenCalledTimes(1)
    expect(print.mock.calls[0]![0]).toContain('Illegal')

    channel.close()
    nuxt.close()
  })

  it('only quotes compile errors from files the dev server may load', async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'nuxt-dev-errors-')))
    const app = join(root, 'app')
    const shared = join(root, 'shared')
    mkdirSync(app)
    mkdirSync(shared)
    const allowed = join(shared, 'allowed.js')
    const denied = join(app, 'blocked.js')
    const outside = join(root, 'outside.js')
    writeFileSync(allowed, 'export const value = "ALLOWED_SOURCE"\n')
    writeFileSync(denied, 'export const value = "DENIED_SOURCE"\n')
    writeFileSync(outside, 'export const value = "OUTSIDE_SOURCE"\n')
    const nuxt = createNuxt()
    nuxt.options.rootDir = app
    const server = await createServer({
      configFile: false,
      logLevel: 'silent',
      root: app,
      server: { middlewareMode: true, ws: false, watch: null, fs: { allow: [app, shared], deny: ['**/blocked.js'] } },
    })
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    reporter.attach(server)
    const failure = (file: string) => ({ message: 'Parse failed', plugin: 'test', id: file, loc: { file, line: 1, column: 1 } })

    try {
      expect(JSON.stringify(await reporter.report(failure(allowed)))).toContain('ALLOWED_SOURCE')
      for (const file of [denied, outside]) {
        const report = await reporter.report(failure(file))
        expect(report?.frames.some(frame => frame.file === file)).toBe(true)
        expect(JSON.stringify(report)).not.toMatch(/DENIED_SOURCE|OUTSIDE_SOURCE/)
      }
    } finally {
      await server.close()
      nuxt.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('leaves printing to a dev server that owns the channel', async () => {
    vi.stubEnv('NUXT_DEV_ERROR_CHANNEL', '/__nuxt_dev__/error')
    const nuxt = createNuxt()
    const print = vi.fn()
    const reporter = createDevErrorReporter(nuxt, { print })

    await reporter.report(transformError)
    expect(print).not.toHaveBeenCalled()

    nuxt.close()
  })

  it.each([
    [transformError.message, transformError.message],
    ['Illegal \u001B\u001B[2J[2J\u001B]52;c;ZXZpbA==\u0007tag\r\nin template', 'Illegal [2J[2J]52;c;ZXZpbA==tag\nin template'],
  ])('prints the raw error, without control characters, when a report cannot be built (%#)', async (message, printed) => {
    const nuxt = createNuxt()
    const print = vi.fn()
    const reporter = createDevErrorReporter(nuxt, { print })
    // `rootDir` is read while building the report, standing in for any failure in `my-bad`
    Object.defineProperty(nuxt.options, 'rootDir', { get: () => { throw new Error('nope') } })

    expect(await reporter.report({ ...transformError, message })).toBeUndefined()
    expect(print).toHaveBeenCalledWith(printed)

    nuxt.close()
  })

  it('leaves showing a report to the channel open pages listen to', async () => {
    const nuxt = createNuxt()
    const { messages, channel } = listen()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const { server, send } = devServer()
    reporter.attach(server)

    await reporter.report(transformError)
    reporter.clear()
    await vi.waitFor(() => expect(messages.map(message => message.type)).toEqual(['nuxt:dev:error:report', 'nuxt:dev:error:clear']))
    expect(send).not.toHaveBeenCalled()

    channel.close()
    nuxt.close()
  })

  it('repeats the current report to a channel that starts listening late, and clears it', async () => {
    const nuxt = createNuxt()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const report = await reporter.report(transformError)

    const { messages, channel } = listen()
    channel.postMessage({ type: 'nuxt:dev:error:sync' })
    await vi.waitFor(() => expect(messages).toHaveLength(1))
    expect(messages[0]).toEqual({ type: 'nuxt:dev:error:report', report })

    reporter.clear()
    reporter.clear()
    await vi.waitFor(() => expect(messages).toHaveLength(2))
    expect(messages[1]).toEqual({ type: 'nuxt:dev:error:clear' })

    channel.close()
    nuxt.close()
  })

  it('reports without a working `BroadcastChannel`', async () => {
    vi.stubGlobal('BroadcastChannel', function () {
      throw new TypeError('Cannot read properties of undefined (reading \'on\')')
    })
    const nuxt = createNuxt()
    const print = vi.fn()
    const reporter = createDevErrorReporter(nuxt, { print })
    const { server } = devServer()
    reporter.attach(server)

    const report = await reporter.report(transformError)
    expect(report).toMatchObject({ kind: 'compile' })
    expect(print).toHaveBeenCalledTimes(1)
    reporter.progress({ phase: 'transform', message: 'Rebuilding' })
    reporter.clear()
    expect(reporter.file).toBeUndefined()

    nuxt.close()
  })
})

/** A client module graph holding one transformed module, as the browser loaded it. */
function clientGraph () {
  const mod = {
    id: '/src/pages/index.vue',
    file: '/src/pages/index.vue',
    // the module's own first line is the third line of what the browser ran
    transformResult: { code: 'import x\nimport y\nthrow new Error("boom")\n', map: { version: 3, names: [], sources: ['/src/pages/index.vue'], mappings: ';;AACA' } },
  }
  return {
    urlToModuleMap: new Map([['/pages/index.vue', mod]]),
    getModuleById: (id: string) => id === mod.id ? mod : undefined,
    getModulesByFile: (file: string) => file === mod.file ? new Set([mod]) : undefined,
  }
}

describe('createDevErrorReporter (runtime errors from the browser)', () => {
  it('reports an error the browser raised, with its stack resolved to source', async () => {
    const nuxt = createNuxt()
    const print = vi.fn()
    const { messages, channel } = listen()
    const reporter = createDevErrorReporter(nuxt, { print })
    const { server, listeners } = devServer({ graph: clientGraph() })
    reporter.attach(server)

    // the browser loaded the module under the bundler's base
    listeners['nuxt:dev:client-error']!({ name: 'Error', message: 'boom', stack: 'Error: boom\n    at setup (http://localhost:3000/_nuxt/pages/index.vue?t=1:3:1)', requestId: 'page-load' })
    await vi.waitFor(() => expect(messages).toHaveLength(1))

    expect(reporter.isRuntime).toBe(true)
    expect(messages[0]).toMatchObject({ type: 'nuxt:dev:error:report', requestId: 'page-load' })
    expect(messages[0].report).toMatchObject({
      name: 'Error',
      message: 'boom',
      frames: [{ function: 'setup', file: '/src/pages/index.vue', line: 2, compiled: { line: 3 } }],
    })
    expect(print).toHaveBeenCalledTimes(1)

    channel.close()
    nuxt.close()
  })

  it('repeats a compile error to every page while a browser error is still being reported', async () => {
    const nuxt = createNuxt()
    const print = vi.fn()
    const { messages, channel } = listen()
    const reporter = createDevErrorReporter(nuxt, { print })
    const { server, listeners } = devServer({ graph: clientGraph() })
    reporter.attach(server)
    await reporter.report(transformError)
    await vi.waitFor(() => expect(messages).toHaveLength(1))
    // the browser error never finishes being reported
    Object.defineProperty(nuxt.options, 'rootDir', { get: () => { throw new Error('nope') } })

    listeners['nuxt:dev:client-error']!({ name: 'Error', message: 'boom', stack: 'Error: boom', requestId: 'page-load' })
    await vi.waitFor(() => expect(print).toHaveBeenCalledTimes(2))
    channel.postMessage({ type: 'nuxt:dev:error:sync' })
    await vi.waitFor(() => expect(messages).toHaveLength(2))
    expect(messages[1]).toMatchObject({ type: 'nuxt:dev:error:report', report: { kind: 'compile' } })
    expect(messages[1].requestId).toBeUndefined()

    channel.close()
    nuxt.close()
  })

  it('repeats a compile error after a browser error to every page, not the page that raised the browser error', async () => {
    const nuxt = createNuxt()
    const { messages, channel } = listen()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const { server, listeners } = devServer({ graph: clientGraph() })
    reporter.attach(server)

    listeners['nuxt:dev:client-error']!({ name: 'Error', message: 'boom', stack: 'Error: boom\n    at setup (http://localhost:3000/_nuxt/pages/index.vue?t=1:3:1)', requestId: 'page-load' })
    await vi.waitFor(() => expect(messages).toHaveLength(1))
    await reporter.report(transformError)
    await vi.waitFor(() => expect(messages).toHaveLength(2))

    channel.postMessage({ type: 'nuxt:dev:error:sync' })
    await vi.waitFor(() => expect(messages).toHaveLength(3))
    expect(messages[2]).toMatchObject({ type: 'nuxt:dev:error:report', report: { kind: 'compile' } })
    expect(messages[2].requestId).toBeUndefined()

    channel.close()
    nuxt.close()
  })

  it('does not publish a browser error the page recovered from while it was being reported', async () => {
    const nuxt = createNuxt()
    const { messages, channel } = listen()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const { server, listeners } = devServer({ graph: clientGraph() })
    reporter.attach(server)

    listeners['nuxt:dev:client-error']!({ name: 'Error', message: 'boom', stack: 'Error: boom', requestId: 'page-load' })
    listeners['nuxt:dev:client-error:clear']!({ requestId: 'page-load' })
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(messages).toEqual([])
    expect(reporter.isRuntime).toBe(false)

    channel.close()
    nuxt.close()
  })

  it('clears the error a page published when it recovers while reporting another', async () => {
    const nuxt = createNuxt()
    const { messages, channel } = listen()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const { server, listeners } = devServer({ graph: clientGraph() })
    reporter.attach(server)

    listeners['nuxt:dev:client-error']!({ name: 'Error', message: 'first', stack: 'Error: first', requestId: 'page-load' })
    await vi.waitFor(() => expect(messages).toHaveLength(1))
    listeners['nuxt:dev:client-error']!({ name: 'Error', message: 'second', stack: 'Error: second', requestId: 'page-load' })
    listeners['nuxt:dev:client-error:clear']!({ requestId: 'page-load' })
    await vi.waitFor(() => expect(messages).toHaveLength(2))
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(messages).toHaveLength(2)
    expect(messages[1]).toEqual({ type: 'nuxt:dev:error:clear', id: messages[0].report.id, requestId: 'page-load' })

    channel.close()
    nuxt.close()
  })

  it('keeps the error one page raised when another page recovers', async () => {
    const nuxt = createNuxt()
    const { messages, channel } = listen()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const { server, listeners } = devServer({ graph: clientGraph() })
    reporter.attach(server)

    listeners['nuxt:dev:client-error']!({ name: 'Error', message: 'first', stack: 'Error: first', requestId: 'first' })
    listeners['nuxt:dev:client-error']!({ name: 'Error', message: 'second', stack: 'Error: second', requestId: 'second' })
    await vi.waitFor(() => expect(messages).toHaveLength(2))
    const first = messages.find(message => message.requestId === 'first')

    listeners['nuxt:dev:client-error:clear']!({ requestId: 'second' })
    expect(reporter.isRuntime).toBe(true)
    channel.postMessage({ type: 'nuxt:dev:error:sync' })
    await vi.waitFor(() => expect(messages).toHaveLength(4))

    expect(messages[2]).toMatchObject({ type: 'nuxt:dev:error:clear', id: expect.any(String) })
    expect(messages[2].id).not.toBe(first.report.id)
    expect(messages[3]).toEqual({ type: 'nuxt:dev:error:report', report: first.report, requestId: 'first' })

    channel.close()
    nuxt.close()
  })

  it('drops frames that name a file the browser was never served', async () => {
    const nuxt = createNuxt()
    const { messages, channel } = listen()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const { server, listeners } = devServer({ graph: clientGraph() })
    reporter.attach(server)

    listeners['nuxt:dev:client-error']!({
      name: 'Error',
      message: 'boom',
      stack: [
        'Error: boom',
        '    at setup (http://localhost:3000/_nuxt/pages/index.vue?t=1:3:1)',
        '    at read (/etc/passwd:1:1)',
        '    at env (file:///src/.env:1:1)',
      ].join('\n'),
    })
    await vi.waitFor(() => expect(messages).toHaveLength(1))

    expect(messages[0].report.frames.map((frame: { file?: string }) => frame.file)).toEqual(['/src/pages/index.vue'])

    channel.close()
    nuxt.close()
  })

  it('ignores an error raised only by code the dev server never served', async () => {
    const nuxt = createNuxt()
    const print = vi.fn()
    const { messages, channel } = listen()
    const reporter = createDevErrorReporter(nuxt, { print })
    const { server, listeners } = devServer({ graph: clientGraph() })
    reporter.attach(server)

    listeners['nuxt:dev:client-error']!({
      name: 'Error',
      message: '[devframe] Timeout waiting for rpc to be trusted',
      stack: 'Error: [devframe] Timeout waiting for rpc to be trusted\n    at http://localhost:3000/__devtools/assets/client.js:1:2\n    at chrome-extension://abc/content.js:3:4',
      requestId: 'devtools-page-load',
    })
    listeners['nuxt:dev:client-error']!({ name: 'Error', message: 'boom', stack: 'Error: boom\n    at setup (http://localhost:3000/_nuxt/pages/index.vue?t=1:3:1)', requestId: 'page-load' })
    await vi.waitFor(() => expect(messages).toHaveLength(1))
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ requestId: 'page-load', report: { message: 'boom' } })
    expect(print).toHaveBeenCalledTimes(1)

    channel.close()
    nuxt.close()
  })

  it('does not read a file a client names in its message', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nuxt-dev-errors-'))
    const outside = join(dir, 'outside-of-the-project.txt')
    writeFileSync(outside, 'should never reach a report\n')
    const nuxt = createNuxt()
    const print = vi.fn()
    const { messages, channel } = listen()
    const reporter = createDevErrorReporter(nuxt, { print })
    const { server, listeners } = devServer({ graph: clientGraph() })
    reporter.attach(server)

    listeners['nuxt:dev:client-error']!({ name: 'Error', message: `boom\n${outside}:1:1`, stack: 'Error: boom' })
    await vi.waitFor(() => expect(messages).toHaveLength(1))

    expect(print).toHaveBeenCalledTimes(1)
    expect(messages[0].report).toMatchObject({ kind: 'error', name: 'Error', message: `boom\n${outside}:1:1` })
    expect(messages[0].report.frames).toEqual([])
    expect(JSON.stringify(messages[0].report)).not.toContain('should never reach a report')

    rmSync(dir, { recursive: true })
    channel.close()
    nuxt.close()
  })

  it('strips control characters from a runtime error it prints raw', async () => {
    const nuxt = createNuxt()
    const print = vi.fn()
    const reporter = createDevErrorReporter(nuxt, { print })
    const { server, listeners } = devServer({ graph: clientGraph() })
    reporter.attach(server)
    Object.defineProperty(nuxt.options, 'rootDir', { get: () => { throw new Error('nope') } })

    listeners['nuxt:dev:client-error']!({ name: '\u001B[2J', message: 'boom', stack: 'Error: \u001B\u001B[31m[31mboom\u0007' }, { send: vi.fn() })
    await vi.waitFor(() => expect(print).toHaveBeenCalledTimes(1))
    expect(print).toHaveBeenCalledWith('Error: [31m[31mboom')

    nuxt.close()
  })

  it('ignores hmr events whose fields do not have the expected types', async () => {
    const nuxt = createNuxt()
    const print = vi.fn()
    const { messages, channel } = listen()
    const reporter = createDevErrorReporter(nuxt, { print })
    const { server, listeners } = devServer({ graph: clientGraph() })
    reporter.attach(server)
    const client = { send: vi.fn() }

    for (const data of [null, 'boom', { message: 42 }]) {
      listeners['nuxt:dev:client-error']!(data, client)
      expect(() => listeners['nuxt:dev:client-error:clear']!(data, client)).not.toThrow()
    }
    listeners['nuxt:dev:client-error']!({ name: 42, message: 'boom', stack: {}, requestId: 42 }, client)
    await vi.waitFor(() => expect(messages).toHaveLength(1))

    expect(messages[0].report).toMatchObject({ name: 'Error', message: 'boom' })
    expect(print).toHaveBeenCalledTimes(1)

    channel.close()
    nuxt.close()
  })

  it('reports a runtime error once per page load that raises it', async () => {
    const nuxt = createNuxt()
    const { messages, channel } = listen()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const { server, listeners } = devServer({ graph: clientGraph() })
    reporter.attach(server)

    const error = { name: 'Error', message: 'boom', stack: 'Error: boom\n    at setup (http://localhost:3000/_nuxt/pages/index.vue?t=1:3:1)' }
    listeners['nuxt:dev:client-error']!({ ...error, requestId: 'first' })
    await vi.waitFor(() => expect(messages).toHaveLength(1))
    listeners['nuxt:dev:client-error']!({ ...error, requestId: 'first' })
    listeners['nuxt:dev:client-error']!({ ...error, requestId: 'reloaded' })
    await vi.waitFor(() => expect(messages).toHaveLength(2))

    expect(messages.map(message => message.requestId)).toEqual(['first', 'reloaded'])

    channel.close()
    nuxt.close()
  })

  it('clears a runtime error once the page that raised it renders another route', async () => {
    const nuxt = createNuxt()
    const { messages, channel } = listen()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const { server, listeners } = devServer({ graph: clientGraph() })
    reporter.attach(server)

    listeners['nuxt:dev:client-error']!({ name: 'Error', message: 'boom', stack: 'Error: boom', requestId: 'raised' })
    await vi.waitFor(() => expect(messages).toHaveLength(1))

    listeners['nuxt:dev:client-error:clear']!({ requestId: 'another' })
    expect(reporter.isRuntime).toBe(true)
    listeners['nuxt:dev:client-error:clear']!({ requestId: 'raised' })
    expect(reporter.isRuntime).toBe(false)
    await vi.waitFor(() => expect(messages[1]).toEqual({ type: 'nuxt:dev:error:clear', id: messages[0].report.id, requestId: 'raised' }))

    channel.close()
    nuxt.close()
  })
})

describe('createDevErrorReporter (errors serving a request)', () => {
  function workerError () {
    return Object.assign(new Error('boom from the worker'), { stack: 'Error: boom from the worker' })
  }

  it('reports the error with the request that raised it, and retires it once the request is served', async () => {
    const nuxt = createNuxt()
    const { messages, channel } = listen()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    reporter.attach(devServer().server)

    await reporter.reportRequestError(workerError(), 'GET /api/throw', 'page-load')
    await vi.waitFor(() => expect(messages).toHaveLength(1))
    expect(messages[0]).toMatchObject({ type: 'nuxt:dev:error:report', request: 'GET /api/throw', requestId: 'page-load', report: { kind: 'error', message: 'boom from the worker' } })
    expect(reporter.isRuntime).toBe(true)
    expect(reporter.hasRequestError('GET /api/throw')).toBe(true)

    reporter.requestServed('GET /api/other')
    reporter.requestServed('GET /api/throw')
    await vi.waitFor(() => expect(messages).toHaveLength(2))
    expect(messages[1]).toEqual({ type: 'nuxt:dev:error:clear', id: messages[0].report.id, request: 'GET /api/throw' })
    expect(reporter.isRuntime).toBe(false)

    channel.close()
    nuxt.close()
  })

  it('repeats the error with its request when the channel asks', async () => {
    const nuxt = createNuxt()
    const { messages, channel } = listen()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    reporter.attach(devServer().server)

    await reporter.reportRequestError(workerError(), 'GET /api/throw')
    await vi.waitFor(() => expect(messages).toHaveLength(1))
    channel.postMessage({ type: 'nuxt:dev:error:sync' })
    await vi.waitFor(() => expect(messages).toHaveLength(2))

    expect(messages[1]).toEqual({ type: 'nuxt:dev:error:report', report: messages[0].report, request: 'GET /api/throw' })

    channel.close()
    nuxt.close()
  })

  it('leaves transform failures and values that are not errors to the compile path', async () => {
    const nuxt = createNuxt()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    reporter.attach(devServer().server)

    await reporter.reportRequestError(Object.assign(new Error('nope'), transformError), 'GET /')
    await reporter.reportRequestError('boom', 'GET /')

    expect(reporter.hasRequestError('GET /')).toBe(false)
    nuxt.close()
  })
})

describe('DevRequestErrorsPlugin', () => {
  it('reports an error a middleware passes on, with its request, and hands it to vite', () => {
    const reporter = { reportRequestError: vi.fn(() => Promise.resolve()) }
    const use = vi.fn()
    const plugin = DevRequestErrorsPlugin(reporter as any)
    const postHook = (plugin.configureServer as { handler: (server: unknown) => () => void }).handler({ middlewares: { use } })
    postHook()
    const middleware = use.mock.calls[0]![0]
    const next = vi.fn()
    const error = new Error('boom')

    middleware(error, { method: 'GET', url: '/throw', originalUrl: '/api/throw', headers: { 'x-nuxt-dev-request-id': 'page-load' } }, {}, next)

    expect(reporter.reportRequestError).toHaveBeenCalledWith(error, 'GET /api/throw', 'page-load')
    expect(next).toHaveBeenCalledWith(error)
  })
})

describe('createDevErrorReporter (errors reported elsewhere)', () => {
  it('clears a runtime error the server reported, which has no file to fix', async () => {
    const nuxt = createNuxt()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const { messages, channel } = listen()
    const serverReport = { id: 'from-server', kind: 'error', name: 'HTTPError', message: 'hi', frames: [], causes: [], sections: [], timestamp: 0 }
    channel.postMessage({ type: 'nuxt:dev:error:report', report: serverReport })
    await vi.waitFor(() => expect(reporter.isRuntime).toBe(true))

    expect(reporter.file).toBeUndefined()
    reporter.clear()
    await vi.waitFor(() => expect(messages.some(message => message.type === 'nuxt:dev:error:clear')).toBe(true))
    expect(reporter.isRuntime).toBe(false)

    channel.close()
    nuxt.close()
  })

  it('keeps a report the server published open after it is cleared for one request', async () => {
    const nuxt = createNuxt()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const { channel } = listen()
    const serverReport = { id: 'from-server', kind: 'error', name: 'HTTPError', message: 'hi', frames: [], causes: [], sections: [], timestamp: 0 }
    channel.postMessage({ type: 'nuxt:dev:error:report', report: serverReport, request: 'GET /a' })
    channel.postMessage({ type: 'nuxt:dev:error:report', report: serverReport, request: 'GET /b' })
    await vi.waitFor(() => expect(reporter.isRuntime).toBe(true))

    channel.postMessage({ type: 'nuxt:dev:error:clear', id: 'from-server', request: 'GET /a' })
    channel.postMessage({ type: 'nuxt:dev:error:sync' })
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(reporter.isRuntime).toBe(true)

    channel.close()
    nuxt.close()
  })

  it('keeps clearing on updates while another report the server published is still open', async () => {
    const nuxt = createNuxt()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const { channel } = listen()
    const serverReport = { kind: 'error', name: 'HTTPError', message: 'hi', frames: [], causes: [], sections: [], timestamp: 0 }
    channel.postMessage({ type: 'nuxt:dev:error:report', report: { ...serverReport, id: 'tab-a' } })
    channel.postMessage({ type: 'nuxt:dev:error:report', report: { ...serverReport, id: 'tab-b' } })
    channel.postMessage({ type: 'nuxt:dev:error:clear', id: 'tab-a' })
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(reporter.isRuntime).toBe(true)

    channel.postMessage({ type: 'nuxt:dev:error:clear', id: 'tab-b' })
    await vi.waitFor(() => expect(reporter.isRuntime).toBe(false))

    channel.close()
    nuxt.close()
  })

  it('remembers the file from a compile error the server reported, so fixing it clears', async () => {
    const nuxt = createNuxt()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const { messages, channel } = listen()
    const serverReport = {
      id: 'from-server', kind: 'error', name: 'HTTPError', message: 'x', frames: [], sections: [], timestamp: 0,
      causes: [{ id: 'c', kind: 'compile', name: 'SyntaxError', message: 'x', frames: [{ type: 'app', file: '/src/pages/broken.vue', line: 3, column: 1 }], causes: [], sections: [], timestamp: 0 }],
    }
    channel.postMessage({ type: 'nuxt:dev:error:report', report: serverReport })
    await vi.waitFor(() => expect(reporter.file).toBe('/src/pages/broken.vue'))

    reporter.clear()
    await vi.waitFor(() => expect(messages.some(message => message.type === 'nuxt:dev:error:clear')).toBe(true))
    expect(reporter.file).toBeUndefined()

    channel.close()
    nuxt.close()
  })

  it.each(['SyntaxError', 'TypeError', 'ReferenceError'])('keeps a %s the server reported over the hot update vite sends for the same file', async (name) => {
    const nuxt = createNuxt()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const { server, send } = devServer()
    reporter.attach(server)
    const { messages, channel } = listen()
    const serverReport = {
      id: 'from-server', kind: 'error', name: 'HTTPError', message: 'x', frames: [], sections: [], timestamp: 0,
      causes: [{ id: 'c', kind: 'compile', name, message: 'x', frames: [{ type: 'app', file: '/src/app.vue', line: 8, column: 5 }], causes: [], sections: [], timestamp: 0 }],
    }
    channel.postMessage({ type: 'nuxt:dev:error:report', report: serverReport })
    await vi.waitFor(() => expect(reporter.file).toBe('/src/app.vue'))

    server.environments.client!.hot.send({ type: 'error', err: { ...transformError, stack: '    at parse (/src/node_modules/parser.js:1:1)' } })
    expect(send).toHaveBeenCalledTimes(1)
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(messages).toEqual([])

    channel.postMessage({ type: 'nuxt:dev:error:clear' })
    await vi.waitFor(() => expect(reporter.file).toBeUndefined())
    server.environments.client!.hot.send({ type: 'error', err: { ...transformError, stack: '' } })
    await vi.waitFor(() => expect(messages).toHaveLength(1))

    channel.close()
    nuxt.close()
  })
})

describe('createDevErrorReporter (problem sets)', () => {
  it('posts problem sets, and repeats them to a channel that asks', async () => {
    const nuxt = createNuxt()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const { messages, channel } = listen()
    const report: ErrorReport = { id: 'd1', kind: 'error', name: 'vue-tsc', message: 'x', frames: [], causes: [], sections: [], timestamp: 0 }
    const problems = { type: 'nuxt:dev:error:problems', source: 'checker:vue-tsc', reports: [report], meta: { label: 'vue-tsc', status: 'idle' } }

    reporter.setProblems('checker:vue-tsc', [report], { label: 'vue-tsc', status: 'idle' })
    await vi.waitFor(() => expect(messages).toEqual([problems]))

    channel.postMessage({ type: 'nuxt:dev:error:sync' })
    await vi.waitFor(() => expect(messages).toEqual([problems, problems]))

    reporter.clearProblems('checker:vue-tsc')
    reporter.clearProblems('checker:vue-tsc')
    await vi.waitFor(() => expect(messages).toHaveLength(3))
    expect(messages[2]).toEqual({ type: 'nuxt:dev:error:problems:clear', source: 'checker:vue-tsc' })

    channel.postMessage({ type: 'nuxt:dev:error:sync' })
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(messages).toHaveLength(3)

    channel.close()
    nuxt.close()
  })

  it('clears its problem sets when Nuxt closes, and ignores them afterwards', async () => {
    const nuxt = createNuxt()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const { messages, channel } = listen()
    const report: ErrorReport = { id: 'd1', kind: 'error', name: 'vue-tsc', message: 'x', frames: [], causes: [], sections: [], timestamp: 0 }

    reporter.setProblems('checker:vue-tsc', [report], { label: 'vue-tsc' })
    await reporter.report(transformError)
    nuxt.close()
    expect(() => {
      reporter.setProblems('checker:vue-tsc', [report], { label: 'vue-tsc' })
      reporter.clearProblems('checker:vue-tsc')
      reporter.progress({ phase: 'transform', percent: 100 })
      reporter.clear()
    }).not.toThrow()

    await vi.waitFor(() => expect(messages).toHaveLength(3))
    expect(messages[2]).toEqual({ type: 'nuxt:dev:error:problems:clear', source: 'checker:vue-tsc' })
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(messages).toHaveLength(3)

    channel.close()
  })
})

describe('createDevErrorReporter (error names)', () => {
  it.each([
    ['SyntaxError', SyntaxError],
    ['TypeError', TypeError],
    ['ReferenceError', ReferenceError],
  ] as const)('names a %s whose position is recovered from its message', async (name, ErrorClass) => {
    const nuxt = createNuxt()
    const reporter = createDevErrorReporter(nuxt, { print: () => {} })
    const cause = new Error('underlying')
    const error = Object.assign(new ErrorClass('[vue/compiler-sfc] Unexpected token (2:9)', { cause }), { plugin: 'vite:vue', id: '/src/app.vue', loc: { line: 2, column: 9 } })

    const report = await reporter.report(error)
    expect(report).toMatchObject({ kind: 'compile', name, message: expect.stringContaining('Unexpected token'), frames: [{ file: '/src/app.vue', line: 2, column: 10 }] })

    nuxt.close()
  })
})

describe('DevErrorsDevToolsPlugin', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  async function dockOf (nuxt: Nuxt) {
    const plugin = await DevErrorsDevToolsPlugin(nuxt, createDevErrorReporter(nuxt, { print: () => {} }))
    const register = vi.fn()
    ;(plugin as { devtools?: { setup: (ctx: unknown) => void } }).devtools!.setup({ docks: { register } })
    return register.mock.calls[0]![0] as { url: string, title: string }
  }

  it('adds a Problems dock for the channel under the app base URL', async () => {
    const nuxt = createNuxt()
    nuxt.options.app.baseURL = '/base/'
    const dock = await dockOf(nuxt)
    expect(dock.url).toBe('/base/__nuxt_dev__/error/panel?embed')
    expect(dock.title).toBe('Problems')
    nuxt.close()
  })

  it('adds a dock for the channel a dev server in front serves', async () => {
    vi.stubEnv('NUXT_DEV_ERROR_CHANNEL', '/__cli__/error')
    const nuxt = createNuxt()
    expect((await dockOf(nuxt)).url).toBe('/__cli__/error/panel?embed')
    nuxt.close()
  })

  it('tells the channel once the dock is registered, again when it asks, and retracts it when Nuxt closes', async () => {
    const nuxt = createNuxt()
    const { messages, channel } = listen()
    await dockOf(nuxt)
    const devtools = (registered: boolean) => ({ type: 'nuxt:dev:error:devtools', registered })

    await vi.waitFor(() => expect(messages).toEqual([devtools(true)]))
    channel.postMessage({ type: 'nuxt:dev:error:sync' })
    await vi.waitFor(() => expect(messages).toEqual([devtools(true), devtools(true)]))
    nuxt.close()
    await vi.waitFor(() => expect(messages).toEqual([devtools(true), devtools(true), devtools(false)]))

    channel.close()
  })
})

describe('DevErrorsPlugin', () => {
  function hotUpdate (reporter: any, file: string, transform: () => Promise<unknown>) {
    const plugin = DevErrorsPlugin(reporter)
    const hook = plugin.hotUpdate as unknown as (this: { environment: { name: string, transformRequest: () => Promise<unknown> } }, options: { file: string }) => void
    hook.call({ environment: { name: 'client', transformRequest: transform } }, { file })
  }

  it('transforms the file that failed once it changes, reporting progress and clearing the report when it compiles', async () => {
    const reporter = { report: vi.fn(() => Promise.resolve(undefined)), clear: vi.fn(), progress: vi.fn(), file: '/src/app.vue' }
    const transform = vi.fn(() => Promise.resolve({}))

    hotUpdate(reporter, '/src/app.vue', transform)
    await vi.waitFor(() => expect(reporter.progress).toHaveBeenCalledTimes(2))
    expect(reporter.clear).toHaveBeenCalledTimes(1)
    expect(transform).toHaveBeenCalledWith('/src/app.vue')
    expect(reporter.progress.mock.calls).toEqual([
      [{ phase: 'transform', message: 'Rebuilding' }],
      [{ phase: 'transform', percent: 100 }],
    ])
  })

  it('reports the file again when it still fails', async () => {
    const reporter = { report: vi.fn(() => Promise.resolve(undefined)), clear: vi.fn(), progress: vi.fn(), file: '/src/app.vue' }

    hotUpdate(reporter, '/src/app.vue', () => Promise.reject(transformError))
    await vi.waitFor(() => expect(reporter.report).toHaveBeenCalledWith(transformError))
    expect(reporter.clear).not.toHaveBeenCalled()
  })

  it('clears a runtime error on any update, since the page reports it again', () => {
    const reporter = { report: vi.fn(), clear: vi.fn(), progress: vi.fn(), file: undefined, isRuntime: true }

    hotUpdate(reporter, '/src/other.vue', () => Promise.resolve({}))
    expect(reporter.clear).toHaveBeenCalledTimes(1)
  })

  it('leaves a runtime error open while a file still fails to compile, until it does', async () => {
    const reporter = { report: vi.fn(), clear: vi.fn(), progress: vi.fn(), file: '/src/app.vue', isRuntime: true }
    const transform = vi.fn(() => Promise.resolve({}))

    hotUpdate(reporter, '/src/other.vue', transform)
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(reporter.clear).not.toHaveBeenCalled()

    hotUpdate(reporter, '/src/app.vue', transform)
    await vi.waitFor(() => expect(reporter.clear).toHaveBeenCalledTimes(1))
  })

  it('leaves other files and files that compile to vite', async () => {
    const transform = vi.fn(() => Promise.resolve({}))

    hotUpdate({ report: vi.fn(), clear: vi.fn(), file: undefined }, '/src/app.vue', transform)
    hotUpdate({ report: vi.fn(), clear: vi.fn(), file: '/src/app.vue' }, '/src/other.vue', transform)
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(transform).not.toHaveBeenCalled()
  })

  it('retires the error a request raised once the request is served without a server error', () => {
    const reporter = { attach: vi.fn(), hasRequestError: (request: string) => request === 'GET /api/throw', requestServed: vi.fn() }
    const use = vi.fn()
    const plugin = DevErrorsPlugin(reporter as any)
    ;(plugin.configureServer as { handler: (server: unknown) => void }).handler({ middlewares: { use } })
    const middleware = use.mock.calls[0]![0]
    const serve = (url: string, statusCode: number) => {
      const res = new EventTarget() as EventTarget & { statusCode: number, once: (event: string, fn: () => void) => void }
      res.statusCode = statusCode
      res.once = (event, fn) => res.addEventListener(event, fn, { once: true })
      const next = vi.fn()
      middleware({ method: 'GET', url }, res, next)
      expect(next).toHaveBeenCalled()
      res.dispatchEvent(new Event('finish'))
    }

    serve('/api/throw', 500)
    serve('/about', 200)
    expect(reporter.requestServed).not.toHaveBeenCalled()
    serve('/api/throw', 200)
    expect(reporter.requestServed).toHaveBeenCalledWith('GET /api/throw')
  })

  it('transforms once per change even when several environments see it', async () => {
    const reporter = { report: vi.fn(), clear: vi.fn(), progress: vi.fn(), file: '/src/app.vue' }
    const plugin = DevErrorsPlugin(reporter as any)
    const hook = plugin.hotUpdate as unknown as (this: { environment: { name: string, transformRequest: () => Promise<unknown> } }, options: { file: string }) => void
    const transform = vi.fn(() => new Promise(resolve => setTimeout(resolve, 20)))
    for (const name of ['client', 'ssr', 'nitro']) {
      hook.call({ environment: { name, transformRequest: transform } }, { file: '/src/app.vue' })
    }
    await vi.waitFor(() => expect(reporter.clear).toHaveBeenCalledTimes(1))
    expect(transform).toHaveBeenCalledTimes(1)
  })
})
