import type { ErrorReport, SourceLoader } from 'my-bad'
import type { Nuxt } from 'nuxt/schema'
import { getLayerDirectories } from '@nuxt/kit'
import { createFsAccessCheck, createReportFsLoader, openErrorBroadcast } from '../runtime/server/dev-error/index.ts'
import type { ErrorChannelMessage } from '../runtime/server/dev-error/index.ts'

/** A problem a scan found, such as a diagnostic. */
export interface ScanProblem {
  /** Defaults to the label of the source. */
  name?: string
  message: string
  code?: string
  fix?: string
  docs?: string
}

/**
 * Record a problem a scan found under a `key` naming it, along with the files involved, each as
 * `file` or `file:line:column`. `create` builds and logs the problem, and only runs for a problem
 * the previous scan did not find.
 */
export type ScanReporter = (key: string, files: string[], create: () => ScanProblem) => void

/** Logs every problem it is given. */
export const reportScanProblem: ScanReporter = (_key, _files, create) => {
  create()
}

export interface ProblemScan {
  report: ScanReporter
  /** Replace the problems of the previous scan with those this scan found, unless a later scan started. */
  done: () => void
}

export interface ScanProblems {
  /** Start a scan, which is expected to find every problem of its source. */
  scan: () => ProblemScan
}

/**
 * Track the problems a scanner finds, logging each one when it first appears. In development,
 * they are also published to the dev error channel as the problem set of `source`.
 */
export function createScanProblems (nuxt: Nuxt, source: string, label: string): ScanProblems {
  const publish: ProblemPublisher | undefined = nuxt.options.dev ? (...args) => useProblemPublisher(nuxt)(...args) : undefined
  let found = new Map<string, FoundProblem>()
  // problems logged by scans still running, which overlapping scans must not log again
  const pending = new Map<string, ScanProblem>()
  let started = 0
  return {
    scan () {
      const id = ++started
      const next = new Map<string, FoundProblem>()
      return {
        report (key, files, create) {
          if (next.has(key)) {
            return
          }
          let problem = found.get(key)?.problem ?? pending.get(key)
          if (!problem) {
            problem = create()
            pending.set(key, problem)
          }
          next.set(key, { files, problem })
        },
        done () {
          if (id !== started) {
            return
          }
          found = next
          pending.clear()
          publish?.(source, label, next).catch(() => {})
        },
      }
    },
  }
}

interface FoundProblem {
  files: string[]
  problem: ScanProblem
}

type ProblemSetMessage = Extract<ErrorChannelMessage, { type: 'nuxt:dev:error:problems' }>

type ProblemPublisher = (source: string, label: string, problems: Map<string, FoundProblem>) => Promise<void>

const publishers = new WeakMap<Nuxt, ProblemPublisher>()

function useProblemPublisher (nuxt: Nuxt): ProblemPublisher {
  let publisher = publishers.get(nuxt)
  if (publisher) {
    return publisher
  }
  const broadcast = openErrorBroadcast()
  const sets = new Map<string, ProblemSetMessage>()
  const versions = new Map<string, number>()
  let fs: Promise<SourceLoader> | undefined

  broadcast.onmessage = (event) => {
    if ((event.data as ErrorChannelMessage | undefined)?.type === 'nuxt:dev:error:sync') {
      for (const message of sets.values()) {
        broadcast.postMessage(message)
      }
    }
  }
  nuxt.hook('close', () => {
    for (const source of sets.keys()) {
      broadcast.postMessage({ type: 'nuxt:dev:error:problems:clear', source } satisfies ErrorChannelMessage)
    }
    sets.clear()
    broadcast.close()
  })

  publisher = async (source, label, problems) => {
    const version = (versions.get(source) ?? 0) + 1
    versions.set(source, version)
    fs ||= createFsAccessCheck({
      allow: [nuxt.options.workspaceDir, nuxt.options.rootDir, ...getLayerDirectories(nuxt).map(layer => layer.root)],
      deny: [],
    }).then(canRead => createReportFsLoader({ cwd: nuxt.options.rootDir, canRead }))
    const loader = fs
    // the snippets of a report are read when it is built, so each scan builds them again
    const built = await Promise.all([...problems.values()].map(found => loader.then(fs => buildReport(found, label, nuxt.options.rootDir, fs)).catch(() => undefined)))
    if (versions.get(source) !== version) {
      return
    }
    const message: ProblemSetMessage = {
      type: 'nuxt:dev:error:problems',
      source,
      reports: built.filter(report => report !== undefined),
      meta: { group: 'Nuxt', label },
    }
    if (message.reports.length) {
      sets.set(source, message)
    } else if (!sets.delete(source)) {
      return
    }
    broadcast.postMessage(message)
  }
  publishers.set(nuxt, publisher)
  return publisher
}

async function buildReport ({ files, problem }: FoundProblem, label: string, cwd: string, fs: SourceLoader): Promise<ErrorReport> {
  const [{ createReport }, { nuxtPreset }] = await Promise.all([import('my-bad'), import('my-bad/presets')])
  const { name = label, message, code, fix, docs } = problem
  return createReport({ name, message, code, fix, docs, sources: files }, { cwd, kind: 'warning', loaders: [fs], presets: [nuxtPreset()] })
}
