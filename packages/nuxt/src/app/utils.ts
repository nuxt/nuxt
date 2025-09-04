import { captureStackTrace } from 'errx'

/** @since 3.9.0 */
export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

const distURL = import.meta.url.replace(/\/app\/.*$/, '/app')
export function getUserTrace () {
  if (!import.meta.dev) {
    return []
  }

  const trace = captureStackTrace()
  const start = trace.findIndex(entry => !entry.source.startsWith(distURL))
  const end = [...trace].reverse().findIndex(entry => !entry.source.includes('node_modules'))
  if (start === -1 || end === -1) {
    return []
  }
  return trace.slice(start, -end).map(i => ({
    ...i,
    source: i.source.replace(/^file:\/\//, ''),
  }))
}

export function getUserCaller () {
  if (!import.meta.dev) {
    return null
  }

  const { source, line, column } = captureStackTrace().find(entry => !entry.source.startsWith(distURL)) ?? {}

  if (!source) {
    return null
  }

  return {
    source: source.replace(/^file:\/\//, ''),
    line,
    column,
  }
}
