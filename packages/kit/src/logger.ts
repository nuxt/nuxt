import { consola } from 'consola'

/** Numeric verbosity threshold: `0` (fatal/error) through `5` (trace). */
export type NuxtLogLevel = 0 | 1 | 2 | 3 | 4 | 5 | (number & {})

/** The kind of message being logged, which determines how it is rendered. */
export type NuxtLogType = 'silent' | 'fatal' | 'error' | 'warn' | 'log' | 'info' | 'success' | 'fail' | 'ready' | 'start' | 'box' | 'debug' | 'trace' | 'verbose'

/** A structured message, usable in place of a string when logging. */
export interface NuxtLogInput {
  level?: NuxtLogLevel
  tag?: string
  type?: NuxtLogType
  message?: string
  additional?: string | string[]
  args?: unknown[]
  date?: Date
}

/** A fully resolved log record, as passed to reporters. */
export interface NuxtLogObject extends NuxtLogInput {
  level: NuxtLogLevel
  type: NuxtLogType
  tag: string
  args: unknown[]
  date: Date
  [key: string]: unknown
}

export interface NuxtLogReporter {
  /** Declared with method syntax so implementations may narrow the context type. */
  log(logObject: NuxtLogObject, ctx: { options: NuxtLoggerOptions }): void
}

export interface NuxtLogFn {
  (message: NuxtLogInput | unknown, ...args: unknown[]): void
  /** Log the arguments verbatim, bypassing formatting. */
  raw: (...args: unknown[]) => void
}

export interface NuxtLoggerOptions {
  level?: NuxtLogLevel
  reporters?: NuxtLogReporter[]
  /** Default log fields applied to every message. */
  defaults?: NuxtLogInput
  /** Per-type defaults, keyed by log type. */
  types?: Record<NuxtLogType, NuxtLogInput>
  /** How many times an identical message may repeat before it is throttled. */
  throttle?: number
  /** How long, in milliseconds, a throttled message is suppressed for. */
  throttleMin?: number
  stdout?: NodeJS.WriteStream
  stderr?: NodeJS.WriteStream
  /** Replace each log method, for tests. */
  mockFn?: (type: NuxtLogType, defaults: NuxtLogInput) => (...args: any[]) => void
  /** Replace the prompt implementation. */
  prompt?: (message: string, options?: any) => Promise<any>
  formatOptions?: {
    columns?: number
    date?: boolean
    colors?: boolean
    compact?: boolean | number
    errorLevel?: number
    [key: string]: unknown
  }
}

export interface NuxtPromptCommonOptions {
  name?: string
  /** How a cancelled prompt (for example, Ctrl+C) resolves. */
  cancel?: 'default' | 'undefined' | 'null' | 'symbol' | 'reject'
}

export type NuxtTextPromptOptions = NuxtPromptCommonOptions & {
  type?: 'text'
  default?: string
  placeholder?: string
  initial?: string
}

export type NuxtConfirmPromptOptions = NuxtPromptCommonOptions & {
  type: 'confirm'
  initial?: boolean
}

export type NuxtSelectPromptOptions = NuxtPromptCommonOptions & {
  type: 'select'
  initial?: string
  options: (string | { label: string, value?: string, hint?: string })[]
}

export type NuxtMultiSelectPromptOptions = NuxtPromptCommonOptions & {
  type: 'multiselect'
  initial?: string[]
  options: (string | { label: string, value?: string, hint?: string })[]
  required?: boolean
}

export type NuxtPromptOptions = NuxtTextPromptOptions | NuxtConfirmPromptOptions | NuxtSelectPromptOptions | NuxtMultiSelectPromptOptions

/**
 * The logger interface exposed by Nuxt. Structurally satisfied by `consola`,
 * but Nuxt only guarantees the members declared here.
 */
export interface NuxtLogger extends Record<NuxtLogType, NuxtLogFn> {
  /** Current verbosity threshold. Assignable to change what is emitted. */
  level: NuxtLogLevel
  /** The options this logger was created with. */
  options: NuxtLoggerOptions
  /** Create a derived logger with the given options. */
  create: (options: NuxtLoggerOptions) => NuxtLogger
  /** Create a derived logger that prefixes every message with `tag`. */
  withTag: (tag: string) => NuxtLogger
  /** Create a derived logger with default log fields applied. */
  withDefaults: (defaults: NuxtLogInput) => NuxtLogger
  addReporter: (reporter: NuxtLogReporter) => unknown
  removeReporter: (reporter: NuxtLogReporter) => unknown
  setReporters: (reporters: NuxtLogReporter[]) => unknown
  /** Route `console.*` calls through this logger. */
  wrapConsole: () => void
  /** Undo `wrapConsole`. */
  restoreConsole: () => void
  /** Route `console.*`, `process.stdout` and `process.stderr` through this logger. */
  wrapAll: () => void
  /** Undo `wrapAll`. */
  restoreAll: () => void
  /** Route `process.stdout` and `process.stderr` through this logger. */
  wrapStd: () => void
  /** Undo `wrapStd`. */
  restoreStd: () => void
  /** Buffer log output until `resumeLogs` is called. */
  pauseLogs: () => void
  resumeLogs: () => void
  /** Replace every log method, for tests. */
  mockTypes: (mockFn?: NuxtLoggerOptions['mockFn']) => void
  /**
   * Prompt the user for input. The resolved value depends on `options.type`
   * (`text` -> `string`, `confirm` -> `boolean`, `select` -> the chosen option,
   * `multiselect` -> an array of chosen options), and on `options.cancel` when
   * the prompt is dismissed.
   *
   * Declared with method syntax so implementations may narrow the options type.
   */
  prompt(message: string, options?: NuxtPromptOptions): Promise<any>
}

export const logger: NuxtLogger = consola

export function useLogger (tag?: string, options: NuxtLoggerOptions = {}): NuxtLogger {
  return tag ? logger.create(options).withTag(tag) : logger
}
