import { describe, expect, it } from 'vitest'
import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import { defu } from 'defu'

import { _generateTypes } from '../src/template'

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
        "#build": [
          ".",
        ],
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
        "../modules/test/node_modules",
        "../modules/node_modules",
        "../node_modules/@some/module/node_modules",
        "../node_modules",
        "../../node_modules",
      ]
    `)
  })
})
