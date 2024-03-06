import { describe, expect, it } from 'vitest'
import type { Nuxt, NuxtConfig, NuxtOptions } from '@nuxt/schema'
import { defu } from 'defu'

import { _generateTypes } from '../src/template'

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Record<string, any> ? DeepPartial<T[P]> : T[P]
}

const mockNuxt = {
  options: {
    rootDir: '/root',
    srcDir: '/root',
    alias: {
      '~': '/root',
      'some-custom-alias': '/root/some-alias'
    },
    typescript: { includeWorkspace: false },
    buildDir: '/root/.nuxt',
    modulesDir: ['/root/node_modules', '/node_modules'],
    modules: [],
    _layers: [{ config: { srcDir: '/root' } }],
    _installedModules: [],
    _modules: [],
  },
  callHook: () => {},
} satisfies DeepPartial<Nuxt> as unknown as Nuxt

const mockNuxtWithOptions = (options: NuxtConfig) => defu({ options }, mockNuxt) as Nuxt

describe('tsConfig generation', () => {
  it('should add add correct relative paths for aliases', async () => {
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

  it('should add add exclude for module paths', async () => {
    const { tsConfig } = await _generateTypes(mockNuxtWithOptions({
      modulesDir: ['/root/modules/test/node_modules', '/root/modules/node_modules', '/root/node_modules/@some/module/node_modules']
    }))
    expect(tsConfig.exclude).toMatchInlineSnapshot(`
      [
        "../modules/test/node_modules",
        "../modules/node_modules",
        "../node_modules/@some/module/node_modules",
        "../node_modules",
        "../../node_modules",
        "../dist",
      ]
    `)
  })
})
