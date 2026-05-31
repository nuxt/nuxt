import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import { defu } from 'defu'

import { _generateTypes } from '../src/template.ts'

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
        "../dist",
        "../.data",
        "../../node_modules",
      ]
    `)
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
      expect(paths[`${alias}-hooked`]?.[0], `post-hook substitution for ${alias}-hooked`).toMatch(pattern)
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
})
