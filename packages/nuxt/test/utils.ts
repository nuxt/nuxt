import { fileURLToPath } from 'node:url'

export const componentsFixtureDir = fileURLToPath(new URL('components-fixture', import.meta.url))

export function normalizeLineEndings (str: string, normalized = '\n') {
  return str.replace(/\r?\n/g, normalized)
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
