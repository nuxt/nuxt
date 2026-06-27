import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import { defu } from 'defu'
import { findWorkspaceDir } from 'pkg-types'

import { loadNuxtConfig } from '../src/loader/config.ts'
import { _generateTypes, resolveLayerPaths } from '../src/template.ts'
import { getLayerDirectories } from 'nuxt/kit'

const typesFixtureDir = fileURLToPath(new URL('./types-fixture', import.meta.url))

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Record<string, any> ? DeepPartial<T[P]> : T[P]
}

const mockNuxt = {
  options: {
    rootDir: '/my-app',
    srcDir: '/my-app',
    alias: {
      '~': '/my-app',
      'some-custom-alias': '/my-app/some-alias',
    },
    typescript: { includeWorkspace: false },
    buildDir: '/my-app/.nuxt',
    modulesDir: ['/my-app/node_modules', '/node_modules'],
    modules: [],
    extensions: ['.ts', '.mjs', '.js'],
    _layers: [{ config: { rootDir: '/my-app', srcDir: '/my-app' } }],
    _installedModules: [],
    _modules: [],
  },
  callHook: () => {},
} satisfies DeepPartial<Nuxt> as unknown as Nuxt

const mockNuxtWithOptions = (options: NuxtConfig) => defu({ options }, mockNuxt) as Nuxt

describe('tsConfig generation', () => {
  it('should add correct relative paths for aliases', async () => {
    const { tsConfig } = await _generateTypes(mockNuxt)
    expect(tsConfig.compilerOptions?.paths).toMatchInlineSnapshot(`
      {
        "some-custom-alias": [
          "../some-alias",
        ],
        "~": [
          "..",
        ],
      }
    `)
  })

  it('should add exclude for module paths', async () => {
    const { tsConfig } = await _generateTypes(mockNuxtWithOptions({
      modulesDir: ['/my-app/modules/test/node_modules', '/my-app/modules/node_modules', '/my-app/node_modules/@some/module/node_modules'],
    }))
    expect(tsConfig.exclude).toMatchInlineSnapshot(`
      [
        "../../node_modules",
        "../dist",
        "../.data",
        "../modules/*/runtime/server/**/*",
        "../layers/*/server/**/*",
        "../layers/*/modules/*/runtime/server/**/*",
        "../modules/*.*",
        "../nuxt.config.*",
        "../.config/nuxt.*",
        "../layers/*/nuxt.config.*",
        "../layers/*/.config/nuxt.*",
        "../layers/*/modules/*.*",
        "../layers/*/modules/*/*.*",
      ]
    `)
  })

  it('should not exclude layer module runtime files from app tsconfig', async () => {
    const { tsConfig } = await _generateTypes(mockNuxt)
    // a module living in `layers/*/modules/<name>/runtime/**` is part of the app/runtime
    // context; the node-context glob must not be broad enough to exclude it
    // https://github.com/nuxt/nuxt/issues/35310
    expect(tsConfig.include).toEqual(expect.arrayContaining(['../layers/*/modules/*/runtime/**/*']))
    expect(tsConfig.exclude).not.toEqual(expect.arrayContaining(['../layers/*/modules/**/*']))
  })

  it('should not exclude node-context paths from legacy tsconfig', async () => {
    const { legacyTsConfig } = await _generateTypes(mockNuxt)
    // nuxt.config.* and .config/nuxt.* are intentionally in legacyInclude (node context)
    // and must NOT be excluded by the legacy tsconfig
    expect(legacyTsConfig.include).toEqual(expect.arrayContaining(['../nuxt.config.*', '../.config/nuxt.*']))
    expect(legacyTsConfig.exclude).not.toEqual(expect.arrayContaining(['../nuxt.config.*', '../.config/nuxt.*']))
  })

  it('should propagate user-defined excludes to legacy tsconfig', async () => {
    const { legacyTsConfig } = await _generateTypes(mockNuxtWithOptions({
      typescript: { tsConfig: { exclude: ['my-custom-exclude'] } },
    }))
    expect(legacyTsConfig.exclude).toContain('my-custom-exclude')
    // but computed app-only paths must still be absent
    expect(legacyTsConfig.exclude).not.toContain('../nuxt.config.*')
  })

  it('should rewrite `paths` substitutions so TS resolves them to declarations', async () => {
    const fixtureAliases = {
      'nitro/h3': `${typesFixtureDir}/h3.d.mts`,
      'nitro/h3-cjs': `${typesFixtureDir}/h3.d.cts`,
      'nitro/util-ts': `${typesFixtureDir}/util.ts`,
      'nitro/cjs-src': `${typesFixtureDir}/cjs-src.cts`,
      'nitro/runtime-with-dts': `${typesFixtureDir}/runtime.mjs`,
      'nitro/h3-runtime': `${typesFixtureDir}/h3-runtime.mjs`,
      'nitro/cache-lonely': `${typesFixtureDir}/cache.mjs`,
    }
    const nuxt = mockNuxtWithOptions({ alias: fixtureAliases })
    nuxt.callHook = ((name: string, ctx: unknown) => {
      if (name === 'prepare:types') {
        const { tsConfig } = ctx as { tsConfig: { compilerOptions: { paths: Record<string, string[]> } } }
        for (const [alias, target] of Object.entries(fixtureAliases)) {
          tsConfig.compilerOptions.paths[`${alias}-hooked`] = [target]
        }
      }
      return Promise.resolve()
    }) as Nuxt['callHook']

    const { tsConfig } = await _generateTypes(nuxt)
    const paths = tsConfig.compilerOptions?.paths ?? {}

    const expectations: Record<string, RegExp> = {
      // declaration files are preserved as-is
      'nitro/h3': /\/h3\.d\.mts$/,
      'nitro/h3-cjs': /\/h3\.d\.cts$/,
      // `.ts` is in TS's extensionless retry list; strip so a sibling `.d.ts` could be found
      'nitro/util-ts': /\/util$/,
      // `.cts` is not in the retry list and has no declaration sibling; preserved literally
      'nitro/cjs-src': /\/cjs-src\.cts$/,
      // `.mjs` with a sibling `.d.ts` strips so TS retries `.d.ts`
      'nitro/runtime-with-dts': /\/runtime$/,
      // `.mjs` with a sibling `.d.mts` rewrites to the declaration directly
      'nitro/h3-runtime': /\/h3-runtime\.d\.mts$/,
      // `.mjs` with no declarations is preserved literally (TS7016 beats TS2307)
      'nitro/cache-lonely': /\/cache\.mjs$/,
    }

    for (const [alias, pattern] of Object.entries(expectations)) {
      expect(paths[alias]?.[0], `alias-loop substitution for ${alias}`).toMatch(pattern)
      expect(paths[`${alias}-hooked`]?.[0], `resolveConfig substitution for ${alias}-hooked`).toMatch(pattern)
    }
  })

  it('should add #build after #components to paths', async () => {
    const { tsConfig } = await _generateTypes(mockNuxtWithOptions({
      alias: {
        '~': '/my-app',
        '@': '/my-app',
        'some-custom-alias': '/my-app/some-alias',
        '#build': './build-dir',
        '#build/*': './build-dir/*',
        '#imports': './imports',
        '#components': './components',
      },
    }))

    expect(tsConfig.compilerOptions?.paths).toMatchObject({
      '~': [
        '..',
      ],
      'some-custom-alias': [
        '../some-alias',
      ],
      '@': [
        '..',
      ],
      '#imports': [
        './imports',
      ],
      '#components': [
        './components',
      ],
      '#build': [
        './build-dir',
      ],
      '#build/*': [
        './build-dir/*',
      ],
    })
  })

  it('should handle context-aware aliases', async () => {
    const nuxt = mockNuxtWithOptions({
      alias: {
        '#app-only': { path: '/my-app/app-only', context: 'app' },
        '#server-only': { path: '/my-app/server-only', context: 'server' },
        '#shared-alias': { path: '/my-app/shared-alias', context: ['app', 'server'] },
        '#all-alias': '/my-app/all-alias',
      },
    })
    const { tsConfig, nodeTsConfig } = await _generateTypes(nuxt)

    expect(tsConfig.compilerOptions?.paths).toMatchObject({
      '#app-only': [
        '../app-only',
      ],
      '#shared-alias': [
        '../shared-alias',
      ],
      '#all-alias': [
        '../all-alias',
      ],
    })
    expect(tsConfig.compilerOptions?.paths).not.toHaveProperty('#server-only')

    expect(nodeTsConfig.compilerOptions?.paths).toMatchObject({
      '#server-only': [
        '../server-only',
      ],
      '#shared-alias': [
        '../shared-alias',
      ],
      '#all-alias': [
        '../all-alias',
      ],
    })
    expect(nodeTsConfig.compilerOptions?.paths).not.toHaveProperty('#app-only')
  })
})

describe('resolveLayerPaths', async () => {
  const repoRoot = await findWorkspaceDir()

  it('should respect custom nuxt options', async () => {
    const nuxtOptions = await loadNuxtConfig({
      cwd: repoRoot,
      overrides: {
        _prepare: true,
        srcDir: 'app',
        dir: {
          modules: 'custom-modules',
          shared: 'custom-shared',
        },
      },
    })
    const [layer] = getLayerDirectories({ options: nuxtOptions } as Nuxt)
    const paths = resolveLayerPaths(layer!, nuxtOptions.buildDir)
    expect(paths).toMatchInlineSnapshot(`
      {
        "globalDeclarations": [
          "../*.d.ts",
          "../layers/*/*.d.ts",
        ],
        "nitro": [
          "../custom-modules/*/runtime/server/**/*",
          "../layers/*/server/**/*",
          "../layers/*/modules/*/runtime/server/**/*",
        ],
        "node": [
          "../custom-modules/*.*",
          "../nuxt.config.*",
          "../.config/nuxt.*",
          "../layers/*/nuxt.config.*",
          "../layers/*/.config/nuxt.*",
          "../layers/*/modules/*.*",
          "../layers/*/modules/*/*.*",
        ],
        "nuxt": [
          "../app/**/*",
          "../custom-modules/*/runtime/**/*",
          "../test/nuxt/**/*",
          "../tests/nuxt/**/*",
          "../layers/*/app/**/*",
          "../layers/*/modules/*/runtime/**/*",
        ],
        "shared": [
          "../custom-shared/**/*",
          "../custom-modules/*/shared/**/*",
          "../layers/*/shared/**/*",
        ],
        "sharedDeclarations": [
          "../custom-shared/**/*.d.ts",
          "../custom-modules/*/shared/**/*.d.ts",
          "../layers/*/shared/**/*.d.ts",
        ],
      }
    `)
  })
})
