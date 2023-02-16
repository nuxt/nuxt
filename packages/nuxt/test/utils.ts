import { resolve } from 'node:path'

export const fixtureDir = resolve(__dirname, 'fixture')

export function normalizeLineEndings (str: string, normalized = '\n') {
  return str.replace(/\r?\n/g, normalized)
}
