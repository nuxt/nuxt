import { fileURLToPath } from 'node:url'

export const fixtureDir = fileURLToPath(new URL('fixture', import.meta.url))

export function normalizeLineEndings (str: string, normalized = '\n') {
  return str.replace(/\r?\n/g, normalized)
}
