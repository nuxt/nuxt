import { bench, describe } from 'vitest'
import { join } from 'pathe'
import { loadNuxtConfig } from '@nuxt/kit'
import { findWorkspaceDir } from 'pkg-types'

const fixtures = {
  'empty directory': 'node_modules/fixture',
  'basic test fixture': 'test/fixtures/basic',
  'basic test fixture (types)': 'test/fixtures/basic-types',
  'minimal test fixture': 'test/fixtures/minimal',
  'minimal test fixture (types)': 'test/fixtures/minimal-types',
}

describe('loadNuxtConfig', async () => {
  const repoRoot = await findWorkspaceDir()
  for (const fixture in fixtures) {
    const path = join(repoRoot, fixtures[fixture as keyof typeof fixtures])
    bench(`loadNuxtConfig in the ${fixture}`, async () => {
      await loadNuxtConfig({ cwd: path })
    })
  }
})
