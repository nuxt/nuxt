import { fileURLToPath } from 'node:url'

export const componentsFixtureDir = fileURLToPath(new URL('components-fixture', import.meta.url))

export function normalizeLineEndings (str: string, normalized = '\n') {
  return str.replace(/\r?\n/g, normalized)
}

type IdFilter = RegExp | RegExp[] | { include?: RegExp | RegExp[], exclude?: RegExp | RegExp[] } | undefined

/** Evaluate an unplugin `transform.filter.id` option against a module id, mirroring rolldown's exclude-wins semantics. */
export function matchesIdFilter (filter: IdFilter, id: string) {
  if (!filter) { return true }
  const { include, exclude } = filter instanceof RegExp || Array.isArray(filter) ? { include: filter, exclude: undefined } : filter
  const toArray = (value?: RegExp | RegExp[]) => value ? Array.isArray(value) ? value : [value] : []
  if (toArray(exclude).some(re => re.test(id))) { return false }
  const includes = toArray(include)
  return includes.length === 0 || includes.some(re => re.test(id))
}

export function clean (string?: string) {
  const lines = string?.split('\n').filter(l => l.trim()) || []
  const indent = lines.reduce((prev, curr) => {
    const length = curr.match(/^\s+/)?.[0].length ?? 0
    return length < prev ? length : prev
  }, Infinity)

  const re = new RegExp(`^\\s{${indent}}`)
  return lines.map(l => l.replace(re, '')).join('\n')
}
