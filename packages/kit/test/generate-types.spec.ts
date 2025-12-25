import { describe, expect, it } from 'vitest'
import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import { defu } from 'defu'
import { findWorkspaceDir } from 'pkg-types'

import { loadNuxtConfig } from '../src/loader/config.ts'
import { _generateTypes, resolveLayerPaths } from '../src/template.ts'
import { getLayerDirectories } from 'nuxt/kit'

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
    extensions: ['.js', '.mjs', '.ts', '.cjs', '.tsx', '.jsx', '.mts', '.cts'],
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
        "../layers/*/modules/**/*",
      ]
    `)
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
          "../layers/*/modules/**/*",
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
