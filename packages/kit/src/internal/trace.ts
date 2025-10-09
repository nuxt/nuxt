import { captureStackTrace } from 'errx'

const distURL = import.meta.url.replace(/\/dist\/.*$/, '/')

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

const warnings = new Set<string>()

export function warn (warning: string) {
  if (!warnings.has(warning)) {
    console.warn(warning)
    warnings.add(warning)
  }
}
