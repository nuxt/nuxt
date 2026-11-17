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

  it('still registers server type directories when nitro compat auto-imports are opted out', async () => {
    const importDirs = await getNitroImportDirs({ experimental: { nitroAutoImports: false } })
    expect(normalizePaths(importDirs)).toContain('<rootDir>/server/types')
  })

  it('auto-imports h3 and nitro helpers by default', async () => {
    const names = await getNitroImportNames()
    expect(names).toEqual(expect.arrayContaining(['defineEventHandler', 'getQuery', 'useStorage', 'defineNitroPlugin', 'H3Event']))
  })

  it('only stops auto-importing h3 and nitro helpers when nitro compat auto-imports are opted out', async () => {
    const names = await getNitroImportNames({ experimental: { nitroAutoImports: false } })
    for (const name of ['defineEventHandler', 'getQuery', 'createError', 'useStorage', 'defineNitroPlugin', 'cachedEventHandler', 'useRuntimeConfig', 'H3Event', 'EventHandler']) {
      expect(names).not.toContain(name)
    }
    expect(names).toEqual(expect.arrayContaining(['useLayerPrecedence', 'autoimportedFunction', 'someUtils', '__buildAssetsURL', 'defineAppConfig']))
  })

  it('keeps h3 and nitro helpers for module runtime code when nitro compat auto-imports are opted out', async () => {
    const transform = await getModuleImportsTransform({ experimental: { nitroAutoImports: false } })
    const code = [
      `import { useRuntimeConfig } from '#imports'`,
      `export default defineEventHandler(event => [getQuery(event), useRuntimeConfig(event), someUtils])`,
    ].join('\n')

    const result = await transform!(code, join(fixtureDir, 'modules/auto-registered/runtime/server/handler.ts'))
    expect(result?.code.replaceAll(fixtureDir, '<rootDir>')).toMatchInlineSnapshot(`
      "import { defineEventHandler, getQuery } from 'h3';
      import { someUtils } from '<rootDir>/modules/auto-registered/runtime/some-server-import';
      import { useRuntimeConfig } from 'nitropack/runtime/internal/config';
      export default defineEventHandler(event => [getQuery(event), useRuntimeConfig(event), someUtils])"
    `)

    expect(await transform!(code, join(fixtureDir, 'server/api/handler.ts'))).toBeUndefined()
    expect(await transform!(code, join(fixtureDir, 'modules/auto-registered/runtime/node_modules/dep/index.js'))).toBeUndefined()
  })

  it('does not auto-import into module runtime code matched by a glob in `nitro.imports.exclude`', async () => {
    const transform = await getModuleImportsTransform({
      experimental: { nitroAutoImports: false },
      nitro: { imports: { exclude: [join(fixtureDir, 'modules/auto-registered/runtime/server/**')] } },
    })
    const code = [
      `import { useRuntimeConfig } from '#imports'`,
      `export default defineEventHandler(event => useRuntimeConfig(event))`,
    ].join('\n')

    const result = await transform!(code, join(fixtureDir, 'modules/auto-registered/runtime/server/handler.ts'))
    expect(result?.code).toMatchInlineSnapshot(`
      "import { useRuntimeConfig } from 'nitropack/runtime/internal/config';
      export default defineEventHandler(event => useRuntimeConfig(event))"
    `)
  })

  it('leaves module runtime code to nitro auto-imports by default', async () => {
    expect(await getModuleImportsTransform()).toBeUndefined()
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

async function getNitroImportNames (overrides?: NuxtConfig) {
  let names: string[] = []
  const nuxt = await loadNuxt({
    cwd: fixtureDir,
    ready: true,
    overrides: {
      ...overrides,
      hooks: {
        async 'nitro:init' (nitro) {
          const imports = await nitro.unimport?.getImports() || []
          names = imports.map(i => i.as || i.name)
        },
      },
    },
  })
  await nuxt.close()
  return names
}

async function getModuleImportsTransform (overrides?: NuxtConfig) {
  let transform: ((code: string, id: string) => Promise<{ code: string } | undefined>) | undefined
  const nuxt = await loadNuxt({
    cwd: fixtureDir,
    ready: true,
    overrides: {
      ...overrides,
      hooks: {
        'nitro:init' (nitro) {
          const plugins = [nitro.options.rollupConfig?.plugins].flat() as Array<{ name?: string, transform?: typeof transform }>
          transform = plugins.find(plugin => plugin?.name === 'nuxt:nitro-module-imports')?.transform
        },
      },
    },
  })
  await nuxt.close()
  return transform
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
