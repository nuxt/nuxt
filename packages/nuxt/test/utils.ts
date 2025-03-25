import { fileURLToPath } from 'node:url'

export const componentsFixtureDir = fileURLToPath(new URL('components-fixture', import.meta.url))

export function normalizeLineEndings (str: string, normalized = '\n') {
  return str.replace(/\r?\n/g, normalized)
}
