import { describe, expect, it } from 'vitest'
import { join } from 'pathe'
import type { NuxtConfig } from '@nuxt/schema'
import { loadNuxt } from '../src/index.ts'
import { findWorkspaceDir } from 'pkg-types'

const repoRoot = await findWorkspaceDir()
const fixtureDir = join(repoRoot, 'test/fixtures/basic')

describe('loadNuxt', () => {
  it('adds shared and server type directories for layers to nitro auto-imports in v4', async () => {
    const importDirs = await getNitroImportDirs()
    // `shared/types` is available in both contexts, `server/types` is server-only (#35763)
    expect(normalizePaths(importDirs)).toMatchInlineSnapshot(`
      [
        "<rootDir>/shared/utils",
        "<rootDir>/shared/types",
        "<rootDir>/server/types",
        "<rootDir>/extends/bar/shared/utils",
        "<rootDir>/extends/bar/shared/types",
        "<rootDir>/extends/bar/server/types",
        "<rootDir>/layers/bar/shared/utils",
        "<rootDir>/layers/bar/shared/types",
        "<rootDir>/layers/bar/server/types",
        "<rootDir>/extends/node_modules/foo/shared/utils",
        "<rootDir>/extends/node_modules/foo/shared/types",
        "<rootDir>/extends/node_modules/foo/server/types",
      ]
    `)
  })

  it('adds app and shared type directories for layers to app auto-imports, but not server-only ones (#35763)', async () => {
    const composablesDirs = await getAppImportDirs()
    const normalized = normalizePaths(composablesDirs)
    // `app/types` (srcDir/types) is auto-imported in the app context
    expect(normalized).toContain('<rootDir>/app/types')
    // `shared/types` is available in both contexts
    expect(normalized).toContain('<rootDir>/shared/types')
    // `server/types` is server-only and must NOT leak into the app context
    expect(normalized).not.toContain('<rootDir>/server/types')
  })

  it('does not register server type directories when nitro auto-imports are opted out', async () => {
    const importDirs = await getNitroImportDirs({ experimental: { nitroAutoImports: false } })
    // `nitro.imports` is disabled entirely, so no directories (incl. `server/types`) are scanned
    expect(normalizePaths(importDirs)).not.toContain('<rootDir>/server/types')
    expect(importDirs).toHaveLength(0)
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

async function getAppImportDirs (overrides?: NuxtConfig) {
  let composablesDirs: unknown[] = []
  const nuxt = await loadNuxt({
    cwd: fixtureDir,
    ready: true,
    overrides: {
      ...overrides,
      hooks: {
        'imports:dirs' (dirs) {
          composablesDirs = [...dirs]
        },
      },
    },
  })
  await nuxt.close()
  return composablesDirs
}
