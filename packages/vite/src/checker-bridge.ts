import type { Plugin as VitePlugin } from 'vite'
import { createProblemReport } from 'my-bad'
import type { ErrorReport } from 'my-bad'
import type { ProblemStatus } from 'my-bad/channel'
import type { CheckerApi, CheckerStatus, Diagnostic } from 'vite-plugin-checker'

import type { ProblemSink } from './dev-errors.ts'

/**
 * The api of the first vite-plugin-checker instance among `plugins`. Instances in one Vite
 * config share their checkers, so any one of them reports every checker, including those a
 * project adds itself.
 */
export function findCheckerApi (plugins: readonly VitePlugin[]): CheckerApi | undefined {
  for (const plugin of plugins) {
    const api = (plugin as VitePlugin<Partial<CheckerApi> | undefined>).api
    if (plugin.name === 'vite-plugin-checker' && api?.protocol === 1) {
      return api as CheckerApi
    }
  }
}

export function toProblemStatus (status: CheckerStatus): ProblemStatus {
  return status === 'idle' || status === 'failed' ? status : 'checking'
}

export function toErrorReport (diagnostic: Diagnostic, label: string): ErrorReport {
  const { snippet } = diagnostic
  return createProblemReport({
    name: label,
    message: diagnostic.message,
    code: diagnostic.code,
    docsUrl: diagnostic.docsUrl,
    file: diagnostic.file,
    line: diagnostic.line,
    column: diagnostic.column,
    snippet: snippet && { start: snippet.start, lines: snippet.lines, lang: snippet.lang },
    kind: diagnostic.level === 'error' ? 'error' : 'warning',
  })
}

interface CheckerEntry {
  label: string
  status: CheckerStatus
  error?: string
  files: Map<string, Diagnostic[]>
}

/**
 * Publish each checker's diagnostics as a problem set of its own, and claim the indicator and
 * the DevTools panel so the checker hides its own badge, dock and messages. Returns a function
 * that undoes all of it.
 */
export function bridgeChecker (api: CheckerApi, sink: ProblemSink): () => void {
  const checkers = new Map<string, CheckerEntry>()
  const dirty = new Set<string>()
  let closed = false

  const entryOf = (checkerId: string): CheckerEntry => {
    let entry = checkers.get(checkerId)
    if (!entry) {
      entry = { label: checkerId, status: 'starting', files: new Map() }
      checkers.set(checkerId, entry)
    }
    return entry
  }

  // updates arrive per file
  const schedule = (checkerId: string) => {
    if (dirty.size === 0) {
      queueMicrotask(flush)
    }
    dirty.add(checkerId)
  }

  function flush () {
    for (const checkerId of dirty) {
      const entry = checkers.get(checkerId)!
      const reports = [...entry.files.values()].flat()
        .filter(diagnostic => diagnostic.level !== 'info')
        .map(diagnostic => toErrorReport(diagnostic, entry.label))
      if (!closed) {
        sink.setProblems(sourceOf(checkerId), reports, {
          label: entry.label,
          status: toProblemStatus(entry.status),
          error: entry.error,
        })
      }
    }
    dirty.clear()
  }

  const release = api.claimIndicator('nuxt')
  // older checkers have no DevTools claim, and always show their own panel
  const releaseDevTools = (api as CheckerApi & { claimDevTools?: (owner: string) => () => void }).claimDevTools?.('nuxt')

  for (const state of api.getState()) {
    const entry = entryOf(state.id)
    entry.label = state.label
    entry.status = state.status
    entry.error = state.error
    for (const diagnostic of state.diagnostics) {
      const file = diagnostic.file ?? ''
      const diagnostics = entry.files.get(file)
      if (diagnostics) {
        diagnostics.push(diagnostic)
      } else {
        entry.files.set(file, [diagnostic])
      }
    }
    schedule(state.id)
  }

  const unsubscribe = api.subscribe((event) => {
    const entry = entryOf(event.checkerId)
    if (event.type === 'status') {
      entry.label = event.label
      entry.status = event.status
      entry.error = event.error
    } else {
      for (const [file, diagnostics] of Object.entries(event.files)) {
        if (diagnostics.length) {
          entry.files.set(file, diagnostics)
        } else {
          entry.files.delete(file)
        }
      }
    }
    schedule(event.checkerId)
  })

  return () => {
    if (closed) {
      return
    }
    closed = true
    unsubscribe()
    release()
    releaseDevTools?.()
    for (const checkerId of checkers.keys()) {
      sink.clearProblems(sourceOf(checkerId))
    }
  }
}

const sourceOf = (checkerId: string) => `checker:${checkerId}`

/** Shows the diagnostics of every vite-plugin-checker checker on the dev error channel. */
export function CheckerBridgePlugin (sink: ProblemSink): VitePlugin {
  let api: CheckerApi | undefined
  let close: (() => void) | undefined
  return {
    name: 'nuxt:checker-bridge',
    apply: 'serve',
    configResolved (config) {
      api = findCheckerApi(config.plugins)
    },
    configureServer () {
      if (api) {
        close = bridgeChecker(api, sink)
      }
    },
    buildEnd () {
      close?.()
      close = undefined
    },
  }
}
