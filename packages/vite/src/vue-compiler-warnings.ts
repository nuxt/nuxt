import { AsyncLocalStorage } from 'node:async_hooks'
import type { Nuxt } from '@nuxt/schema'
import { createProblemReport } from 'my-bad'
import type { ErrorReport } from 'my-bad'
import type { ViteDevServer, Plugin as VitePlugin } from 'vite'
import { parseVueRequest } from '@vitejs/plugin-vue'
import { stripAnsi } from 'consola/utils'
import { normalize } from 'pathe'
import type { ProblemSink } from './dev-errors.ts'

const VUE_COMPILER_SOURCE = 'vue:compiler'
const VUE_COMPILER_LABEL = 'Vue'

/** A warning the Vue SFC compiler raised while compiling a file. */
export interface VueCompilerWarning {
  file: string
  message: string
  line?: number
  column?: number
  /** The code frame the compiler marked the position in. */
  frame?: string
  /** Page the compiler links for the warning. */
  docs?: string
}

/** `12 |  <div>`, a line of a code frame as `@vue/shared` renders one. */
const FRAME_LINE_RE = /^(\d+)\s*\| {2}(.*)$/
/** `   |    ^^^`, the line under it marking the position. */
const CARET_LINE_RE = /^\s+\| {2}( *)\^/
const SFC_PREFIX_RE = /^\[@vue\/compiler-sfc\] /
const DOCS_RE = /\n\s*Details: (\S+)$/

/** Read the message, position and docs link from a warning the Vue compiler printed or passed to `this.warn`. */
export function parseVueCompilerWarning (text: string, file: string): VueCompilerWarning {
  const lines = stripAnsi(text).replace(SFC_PREFIX_RE, '').trimEnd().split('\n')
  const frameStart = lines.findIndex(line => FRAME_LINE_RE.test(line))
  const prose = frameStart === -1 ? lines : lines.slice(0, frameStart)
  // `@vue/compiler-sfc` names the file on the line above the code frame
  if (frameStart > 0 && normalize(prose.at(-1)!.trim()) === file) {
    prose.pop()
  }
  let message = prose.join('\n').trim()
  const docs = DOCS_RE.exec(message)?.[1]
  if (docs) {
    message = message.replace(DOCS_RE, '')
  }
  const warning: VueCompilerWarning = { file, message, ...docs && { docs } }
  if (frameStart === -1) {
    return warning
  }
  let row: { line: number, text: string } | undefined
  for (const line of lines.slice(frameStart)) {
    const numbered = FRAME_LINE_RE.exec(line)
    if (numbered) {
      row = { line: Number(numbered[1]), text: numbered[2]! }
      continue
    }
    const caret = CARET_LINE_RE.exec(line)
    if (caret && row) {
      const column = caret[1]!.length + 1
      const frame = lines.slice(frameStart).join('\n')
      // a position at the start of a line is marked past the end of the line before
      return column > row.text.length + 1
        ? { ...warning, line: row.line + 1, column: 1, frame }
        : { ...warning, line: row.line, column, frame }
    }
  }
  return warning
}

function warningKey (warning: VueCompilerWarning): string {
  return `${warning.file}\0${warning.line ?? ''}:${warning.column ?? ''}\0${warning.message}`
}

interface CompileRecord {
  file: string
  /** Code the module was compiled from, or `undefined` when it cannot be compared. */
  code: string | undefined
  /** For a block of an SFC, such as `?vue&type=style&index=0`, the environment that compiled it. */
  block?: string
  warnings: VueCompilerWarning[]
}

/** The warnings of every module the Vue plugin compiled, kept per module and reconciled per file. */
export function createVueWarningStore () {
  const records = new Map<string, CompileRecord>()

  function keysOf (file: string): Set<string> {
    const keys = new Set<string>()
    for (const record of records.values()) {
      if (record.file === file) {
        record.warnings.forEach(warning => keys.add(warningKey(warning)))
      }
    }
    return keys
  }

  return {
    /**
     * Replace the warnings of the module `key` with those of a compile, returning the keys
     * of the warnings its file did not have before. A compile of the same code adds to them,
     * as `@vue/compiler-sfc` raises some warnings once per process.
     */
    update (key: string, record: CompileRecord): Set<string> {
      const known = keysOf(record.file)
      const previous = records.get(key)
      const sameCode = record.code !== undefined && previous?.code === record.code
      const warnings = sameCode ? [...previous!.warnings, ...record.warnings.filter(warning => !previous!.warnings.some(other => warningKey(other) === warningKey(warning)))] : record.warnings
      if (warnings.length) {
        records.set(key, { ...record, warnings })
      } else {
        records.delete(key)
      }
      return new Set(record.warnings.map(warningKey).filter(warningKey => !known.has(warningKey)))
    },
    /** Forget the warnings of the SFC blocks for which `isImported` returns `false`. */
    prune (isImported: (id: string, environment: string) => boolean): void {
      for (const [key, record] of records) {
        if (record.block && !isImported(key, record.block)) {
          records.delete(key)
        }
      }
    },
    /** Forget the warnings of a deleted file. */
    remove (file: string): boolean {
      let removed = false
      for (const [key, record] of records) {
        if (record.file === file) {
          removed = records.delete(key)
        }
      }
      return removed
    },
    /** The current warnings across all files, each once, in file order. */
    get warnings (): VueCompilerWarning[] {
      const unique = new Map<string, VueCompilerWarning>()
      for (const record of records.values()) {
        record.warnings.forEach(warning => unique.set(warningKey(warning), warning))
      }
      return [...unique.values()].sort((a, b) => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0))
    },
  }
}

/** Build the report a warning is published as. */
export function createVueWarningReport (warning: VueCompilerWarning, cwd: string): ErrorReport {
  return createProblemReport({
    name: VUE_COMPILER_LABEL,
    message: warning.message,
    docsUrl: warning.docs,
    file: warning.file,
    line: warning.line,
    column: warning.column,
    snippet: warning.frame,
    kind: 'warning',
  }, { cwd })
}

interface Capture {
  file: string
  warnings: VueCompilerWarning[]
  /** Print a warning as the compiler would have. */
  replays: Array<{ key: string, print: () => void }>
}

type Handler = (this: unknown, ...args: any[]) => unknown

/**
 * Publish the warnings the Vue plugin raises while compiling SFCs as the `vue:compiler`
 * problem set, and print each to the terminal only when its file did not have it before.
 */
export function VueCompilerWarningsPlugin (nuxt: Nuxt, vue: VitePlugin, sink: ProblemSink): VitePlugin {
  const storage = new AsyncLocalStorage<Capture>()
  const store = createVueWarningStore()
  // vite starts a new transform of a changed module without waiting for the one in flight
  const latest = new Map<string, { compile: number, code: string | undefined }>()
  let compiles = 0
  let server: ViteDevServer | undefined
  const publisher = createPublisher(nuxt, sink, () => {
    store.prune((id, environment) => {
      const graph = server?.environments[environment]?.moduleGraph
      return !graph || !!graph.getModuleById(id)?.importers.size
    })
    return store.warnings
  })

  function record (capture: Capture, text: string, print: () => void, loc?: { line?: unknown, column?: unknown }) {
    const warning = parseVueCompilerWarning(text, capture.file)
    if (typeof loc?.line === 'number' && typeof loc.column === 'number') {
      warning.line = loc.line
      warning.column = loc.column
    }
    capture.warnings.push(warning)
    capture.replays.push({ key: warningKey(warning), print })
  }

  function track (handler: Handler, target: (context: unknown, ...args: any[]) => Omit<CompileRecord, 'warnings'> & { key: string }): Handler {
    return function (this: unknown, ...args: any[]) {
      const { key, ...compiled } = target(this, ...args)
      const compile = ++compiles
      latest.set(key, { compile, code: compiled.code })
      const capture: Capture = { file: compiled.file, warnings: [], replays: [] }
      const context = this && typeof this === 'object' ? withWarn(this, capture) : this
      const settle = (result: unknown) => {
        if ((result === undefined || result === null) && !capture.warnings.length) {
          return result
        }
        const newest = latest.get(key)!
        if (newest.compile !== compile && (newest.code === undefined || newest.code !== compiled.code)) {
          return result
        }
        const added = store.update(key, { ...compiled, warnings: capture.warnings })
        for (const { key, print } of capture.replays) {
          if (added.delete(key)) {
            print()
          }
        }
        publisher.schedule()
        return result
      }
      const fail = (error: unknown) => {
        capture.replays.forEach(({ print }) => print())
        throw error
      }
      let result: unknown
      try {
        result = storage.run(capture, () => handler.apply(context, args))
      } catch (error) {
        return fail(error)
      }
      return isPromise(result) ? result.then(settle, fail) : settle(result)
    }
  }

  function withWarn (context: object, capture: Capture): object {
    const warn = (log: unknown, position?: unknown) => {
      const raw = typeof log === 'function' ? log() : log
      const text = typeof raw === 'string' ? raw : (raw as { message?: unknown } | undefined)?.message
      const original = (context as { warn: (log: unknown, position?: unknown) => void }).warn.bind(context)
      if (typeof text !== 'string') {
        return original(log, position)
      }
      record(capture, text, () => original(raw, position), (raw as { loc?: { line?: unknown, column?: unknown } }).loc)
    }
    return new Proxy(context, {
      get (target, key) {
        if (key === 'warn') {
          return warn
        }
        const value = Reflect.get(target, key, target)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
  }

  wrapHook(vue, 'transform', handler => track(handler, (context, code: string, id: string) => {
    const { filename, query } = parseVueRequest(id)
    const file = normalize(filename)
    if (!query.vue) {
      return { key: file, file, code }
    }
    const environment = (context as { environment?: { name?: string } } | undefined)?.environment?.name
    return { key: id, file, code: query.src ? undefined : code, block: environment }
  }))
  // `@vitejs/plugin-vue` compiles the script of a changed SFC before it is transformed again
  wrapHook(vue, 'handleHotUpdate', handler => track(handler, (_context, { file }: { file: string }) => ({ key: `${normalize(file)}\0hmr`, file: normalize(file), code: undefined })))

  return {
    name: 'nuxt:vue-compiler-warnings',
    apply: 'serve',
    configureServer (devServer) {
      server = devServer
      // `@vue/compiler-sfc` prints script and style warnings rather than returning them
      const original = console.warn
      const intercept = function (this: unknown, ...args: unknown[]) {
        const capture = storage.getStore()
        const text = typeof args[0] === 'string' ? stripAnsi(args[0]) : undefined
        if (!capture || !text || !SFC_PREFIX_RE.test(text)) {
          return original.apply(this, args)
        }
        record(capture, text, () => original.apply(this, args))
      }
      console.warn = intercept
      nuxt.hook('close', () => {
        if (console.warn === intercept) {
          console.warn = original
        }
      })
      devServer.watcher.on('unlink', (file) => {
        if (store.remove(normalize(file))) {
          publisher.schedule()
        }
      })
    },
  }
}

/** Wait this long for compiles to settle before publishing, and never longer than `MAX_DELAY` after the first. */
const DELAY = 100
const MAX_DELAY = 1000

function createPublisher (nuxt: Nuxt, sink: ProblemSink, read: () => VueCompilerWarning[]) {
  let published = '[]'
  let timer: ReturnType<typeof setTimeout> | undefined
  let burstStart: number | undefined
  nuxt.hook('close', () => clearTimeout(timer))

  function flush () {
    const reports = [...new Map(read().map(warning => createVueWarningReport(warning, nuxt.options.rootDir)).map(report => [report.id, report])).values()]
    // a report keeps its id while its snippet or docs link change
    const signature = JSON.stringify(reports, (key, value) => key === 'timestamp' ? undefined : value)
    if (signature === published) {
      return
    }
    published = signature
    sink.setProblems(VUE_COMPILER_SOURCE, reports, { label: VUE_COMPILER_LABEL })
  }

  return {
    schedule () {
      burstStart ??= Date.now()
      clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        burstStart = undefined
        flush()
      }, Math.max(0, Math.min(DELAY, burstStart + MAX_DELAY - Date.now())))
      ;(timer as { unref?: () => void }).unref?.()
    },
  }
}

function wrapHook (plugin: VitePlugin, name: 'transform' | 'handleHotUpdate', wrap: (handler: Handler) => Handler): void {
  const hook = plugin[name] as Handler | { handler?: Handler } | undefined
  if (typeof hook === 'function') {
    ;(plugin as Record<typeof name, unknown>)[name] = wrap(hook)
  } else if (hook && typeof hook.handler === 'function') {
    // the object is kept, as `@vitejs/plugin-vue` sets its `filter` later
    hook.handler = wrap(hook.handler)
  }
}

function isPromise (value: unknown): value is Promise<unknown> {
  return !!value && typeof (value as { then?: unknown }).then === 'function'
}
