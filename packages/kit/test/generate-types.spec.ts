import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import { defu } from 'defu'
import { withoutTrailingSlash } from 'ufo'
import { normalize } from 'pathe'

import { loadNuxtConfig } from '../src/loader/config'
import { _generateTypes, resolveLayerPaths } from '../src/template'

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
    _layers: [{ config: { srcDir: '/my-app' } }],
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
        "../modules/test/node_modules",
        "../modules/node_modules",
        "../node_modules/@some/module/node_modules",
        "../node_modules",
        "../../node_modules",
        "../dist",
        "../.data",
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

describe('resolveLayerPaths', () => {
  const repoRoot = withoutTrailingSlash(normalize(fileURLToPath(new URL('../../../', import.meta.url))))

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
    const paths = resolveLayerPaths(nuxtOptions.dir, nuxtOptions.buildDir, nuxtOptions.rootDir, nuxtOptions.srcDir)
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
