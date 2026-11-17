import { describe, expect, it, vi } from 'vitest'
import { createServer } from 'vite'
import type { Plugin } from 'vite'
import type { CheckerApi, CheckerEvent, CheckerState, Diagnostic } from 'vite-plugin-checker'
import type { ErrorReport } from 'my-bad'

import { CheckerBridgePlugin, bridgeChecker, findCheckerApi, toErrorReport, toProblemStatus } from '../src/checker-bridge.ts'

function createApi (states: CheckerState[] = [], uiUrl = '/_nuxt/__checker/') {
  const listeners = new Set<(event: CheckerEvent) => void>()
  const claims: string[] = []
  const release = vi.fn()
  const api: CheckerApi = {
    protocol: 1,
    getUiUrl: () => uiUrl,
    getState: () => states,
    subscribe (listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    claimIndicator (owner) {
      claims.push(owner)
      return release
    },
  }
  const emit = (event: CheckerEvent) => {
    for (const listener of listeners) {
      listener(event)
    }
  }
  return { api, emit, claims, release, listeners }
}

function createSink () {
  return { setProblems: vi.fn(), clearProblems: vi.fn() }
}

const tick = () => new Promise<void>(resolve => queueMicrotask(resolve))

function diagnostic (overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    id: 'd1',
    checkerId: 'vue-tsc',
    level: 'error',
    message: 'Type \'number\' is not assignable to type \'string\'.',
    code: 'TS2322',
    file: '/src/app.vue',
    line: 3,
    column: 7,
    snippet: { start: 2, lines: ['<script setup lang="ts">', 'const a: string = 1', '</script>'], lang: 'ts' },
    ...overrides,
  }
}

describe('toErrorReport', () => {
  it('maps a diagnostic to a report framed at its location', () => {
    const report = toErrorReport(diagnostic({ docsUrl: 'https://example.com/TS2322' }), 'vue-tsc')
    expect(report).toMatchObject({
      kind: 'error',
      name: 'vue-tsc',
      message: 'Type \'number\' is not assignable to type \'string\'.',
      code: 'TS2322',
      docsUrl: 'https://example.com/TS2322',
      frames: [{ file: '/src/app.vue', line: 3, column: 7, type: 'app', snippet: { start: 2, lines: ['<script setup lang="ts">', 'const a: string = 1', '</script>'], lang: 'ts' } }],
    })
  })

  it('gives a diagnostic a new id once it moves', () => {
    const id = toErrorReport(diagnostic(), 'vue-tsc').id
    expect(toErrorReport(diagnostic(), 'vue-tsc').id).toBe(id)
    expect(toErrorReport(diagnostic({ line: 4 }), 'vue-tsc').id).not.toBe(id)
    expect(toErrorReport(diagnostic(), 'ESLint').id).not.toBe(id)
  })

  it('maps warnings, and diagnostics without a file', () => {
    expect(toErrorReport(diagnostic({ level: 'warning', file: undefined, line: undefined, column: undefined, snippet: undefined }), 'ESLint')).toMatchObject({ kind: 'warning', frames: [] })
  })
})

describe('toProblemStatus', () => {
  it.each([
    ['starting', 'checking'],
    ['checking', 'checking'],
    ['idle', 'idle'],
    ['failed', 'failed'],
  ] as const)('maps %s to %s', (status, expected) => {
    expect(toProblemStatus(status)).toBe(expected)
  })
})

describe('bridgeChecker', () => {
  it('publishes the current state of each checker as its own problem set', async () => {
    const { api } = createApi([
      { id: 'vue-tsc', label: 'vue-tsc', status: 'idle', diagnostics: [diagnostic(), diagnostic({ id: 'i', level: 'info' })] },
      { id: 'eslint', label: 'ESLint', status: 'failed', error: 'no config', diagnostics: [] },
    ])
    const sink = createSink()
    bridgeChecker(api, sink)
    await tick()

    expect(sink.setProblems).toHaveBeenCalledTimes(2)
    expect(sink.setProblems).toHaveBeenCalledWith('checker:vue-tsc', [expect.objectContaining({ code: 'TS2322' })], { label: 'vue-tsc', status: 'idle', error: undefined })
    expect(sink.setProblems).toHaveBeenCalledWith('checker:eslint', [], { label: 'ESLint', status: 'failed', error: 'no config' })
  })

  it('batches the events of a run into one update per checker', async () => {
    const { api, emit } = createApi([{ id: 'vue-tsc', label: 'vue-tsc', status: 'idle', diagnostics: [diagnostic()] }])
    const sink = createSink()
    bridgeChecker(api, sink)
    await tick()
    sink.setProblems.mockClear()

    emit({ type: 'status', checkerId: 'vue-tsc', label: 'vue-tsc', status: 'checking' })
    await tick()
    expect(sink.setProblems).toHaveBeenLastCalledWith('checker:vue-tsc', [expect.objectContaining({ code: 'TS2322' })], expect.objectContaining({ status: 'checking' }))

    emit({ type: 'update', checkerId: 'vue-tsc', files: { '/src/app.vue': [] } })
    emit({ type: 'update', checkerId: 'vue-tsc', files: { '/src/b.ts': [diagnostic({ id: 'd2', file: '/src/b.ts' })] } })
    emit({ type: 'update', checkerId: 'vue-tsc', files: { '/src/c.ts': [diagnostic({ id: 'd3', file: '/src/c.ts', level: 'warning' })] } })
    emit({ type: 'status', checkerId: 'vue-tsc', label: 'vue-tsc', status: 'idle' })
    expect(sink.setProblems).toHaveBeenCalledTimes(1)
    await tick()

    expect(sink.setProblems).toHaveBeenCalledTimes(2)
    const [source, reports, meta] = sink.setProblems.mock.lastCall!
    expect(source).toBe('checker:vue-tsc')
    expect(reports.map((report: ErrorReport) => [report.frames[0]?.file, report.kind])).toEqual([['/src/b.ts', 'error'], ['/src/c.ts', 'warning']])
    expect(meta).toMatchObject({ status: 'idle' })

    emit({ type: 'update', checkerId: 'vue-tsc', files: { '/src/b.ts': [], '/src/c.ts': [] } })
    await tick()
    expect(sink.setProblems).toHaveBeenLastCalledWith('checker:vue-tsc', [], expect.objectContaining({ status: 'idle' }))
  })

  it('labels a checker that starts after bridging from its status', async () => {
    const { api, emit } = createApi()
    const sink = createSink()
    bridgeChecker(api, sink)
    emit({ type: 'status', checkerId: 'eslint', label: 'ESLint', status: 'starting' })
    await tick()
    expect(sink.setProblems).toHaveBeenCalledWith('checker:eslint', [], expect.objectContaining({ label: 'ESLint', status: 'checking' }))
  })

  it('claims the indicator while bridged, and releases it and clears its problem sets on close', async () => {
    const { api, emit, claims, release, listeners } = createApi([{ id: 'vue-tsc', label: 'vue-tsc', status: 'starting', diagnostics: [] }])
    const sink = createSink()
    const close = bridgeChecker(api, sink)
    expect(claims).toEqual(['nuxt'])
    emit({ type: 'status', checkerId: 'eslint', label: 'ESLint', status: 'starting' })
    await tick()

    close()
    close()
    expect(release).toHaveBeenCalledTimes(1)
    expect(listeners.size).toBe(0)
    expect(sink.clearProblems.mock.calls).toEqual([['checker:vue-tsc'], ['checker:eslint']])
  })

  it('claims the DevTools panel while bridged, when the checker supports it', () => {
    const { api } = createApi()
    const releaseDevTools = vi.fn()
    const claimDevTools = vi.fn(() => releaseDevTools)
    const close = bridgeChecker(Object.assign(api, { claimDevTools }), createSink())
    expect(claimDevTools).toHaveBeenCalledWith('nuxt')

    close()
    close()
    expect(releaseDevTools).toHaveBeenCalledTimes(1)
  })

  it('publishes nothing after close', async () => {
    const { api, emit } = createApi([{ id: 'vue-tsc', label: 'vue-tsc', status: 'idle', diagnostics: [] }])
    const sink = createSink()
    const close = bridgeChecker(api, sink)
    emit({ type: 'status', checkerId: 'vue-tsc', label: 'vue-tsc', status: 'checking' })
    close()
    await tick()
    expect(sink.setProblems).not.toHaveBeenCalled()
  })
})

describe('findCheckerApi', () => {
  it('finds a checker instance by name and protocol', () => {
    const { api } = createApi()
    const { api: other } = createApi()
    expect(findCheckerApi([
      { name: 'something-else', api: other },
      { name: 'vite-plugin-checker' },
      { name: 'vite-plugin-checker', api: { ...other, protocol: 2 } },
      { name: 'vite-plugin-checker', api },
      { name: 'vite-plugin-checker', api: other },
    ] as Plugin[])).toBe(api)
    expect(findCheckerApi([{ name: 'vite:vue' }] as Plugin[])).toBeUndefined()
  })
})

describe('CheckerBridgePlugin', () => {
  it('bridges the checkers of the dev server once, through a project\'s own instance', async () => {
    const states: CheckerState[] = [
      { id: 'vue-tsc', label: 'vue-tsc', status: 'idle', diagnostics: [diagnostic()] },
      { id: 'eslint', label: 'ESLint', status: 'idle', diagnostics: [diagnostic({ id: 'e1', checkerId: 'eslint', level: 'warning' })] },
    ]
    const userChecker = createApi(states)
    const nuxtChecker = createApi(states)
    const sink = createSink()

    const server = await createServer({
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true, ws: false },
      plugins: [
        [{ name: 'vite-plugin-checker', api: userChecker.api }],
        { applyToEnvironment: environment => environment.name === 'client', ...{ name: 'vite-plugin-checker', api: nuxtChecker.api } },
        CheckerBridgePlugin(sink),
      ],
    })
    await tick()

    expect(userChecker.claims).toEqual(['nuxt'])
    expect(nuxtChecker.claims).toEqual([])
    expect(sink.setProblems.mock.calls.map(call => call[0])).toEqual(['checker:vue-tsc', 'checker:eslint'])
    expect(sink.setProblems.mock.calls[0]![2]).toEqual({ label: 'vue-tsc', status: 'idle', error: undefined })

    await server.close()
    expect(userChecker.release).toHaveBeenCalledTimes(1)
    expect(sink.clearProblems.mock.calls.map(call => call[0])).toEqual(['checker:vue-tsc', 'checker:eslint'])
  })
})
