import { fileURLToPath } from 'node:url'
import { bench, describe } from 'vitest'
import { join, normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { loadNuxtConfig } from '../src'

const fixtures = {
  'empty directory': 'node_modules/fixture',
  'basic test fixture': 'test/fixtures/basic',
  'basic test fixture (types)': 'test/fixtures/basic-types',
  'minimal test fixture': 'test/fixtures/minimal',
  'minimal test fixture (types)': 'test/fixtures/minimal-types'
}

describe('loadNuxtConfig', () => {
  for (const fixture in fixtures) {
    const relativeDir = join('../../..', fixtures[fixture as keyof typeof fixtures])
    const path = withoutTrailingSlash(normalize(fileURLToPath(new URL(relativeDir, import.meta.url))))
    bench(fixture, async () => {
      await loadNuxtConfig({ cwd: path })
    })
  }
})
