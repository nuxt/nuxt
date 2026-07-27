import { describe, expect, it } from 'vitest'
import { join } from 'pathe'
import type { NuxtConfig } from '@nuxt/schema'
import { loadNuxt } from '../src/index.ts'
import { findWorkspaceDir } from 'pkg-types'

const repoRoot = await findWorkspaceDir()
const fixtureDir = join(repoRoot, 'test/fixtures/basic')

describe('loadNuxt', () => {
  it('adds shared directories for layers to nitro auto-imports in v4', async () => {
    const importDirs = await getNitroImportDirs()
    expect(normalizePaths(importDirs)).toMatchInlineSnapshot(`
      [
        "<rootDir>/shared/utils",
        "<rootDir>/shared/types",
        "<rootDir>/extends/bar/shared/utils",
        "<rootDir>/extends/bar/shared/types",
        "<rootDir>/layers/bar/shared/utils",
        "<rootDir>/layers/bar/shared/types",
        "<rootDir>/extends/node_modules/foo/shared/utils",
        "<rootDir>/extends/node_modules/foo/shared/types",
      ]
    `)
  })
})

function normalizePaths (arr: unknown[]) {
  const normalized = []
  for (const dir of arr) {
    normalized.push(typeof dir === 'string' ? dir.replace(fixtureDir, '<rootDir>') : dir)
  }
  return normalized
}

async function getNitroImportDirs (overrides?: NuxtConfig) {
  const importDirs: unknown[] = []
  const nuxt = await loadNuxt({
    cwd: fixtureDir,
    ready: true,
    overrides: {
      ...overrides,
      hooks: {
        'nitro:config' (config) {
          if (config.imports) {
            importDirs.push(...config.imports.dirs || [])
          }
        },
      },
    },
  })
  await nuxt.close()
  return importDirs
}
