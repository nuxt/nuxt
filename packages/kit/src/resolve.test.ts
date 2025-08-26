import { stat } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { resolve } from 'pathe'
import { withTrailingSlash } from 'ufo'
import { loadNuxt } from './loader/nuxt'
import { findPath, resolveNuxtModule, resolvePath } from './resolve'
import { defineNuxtModule } from './module/define'
import { addTemplate } from './template'

const nuxt = await loadNuxt({
  overrides: {
    modules: [
      defineNuxtModule(() => {
        addTemplate({
          filename: 'my-template.mjs',
          getContents: () => 'export const myUtil = () => \'hello\'',
        })
      }),
    ],
  },
})

describe('resolvePath', () => {
  it('should resolve paths correctly', async () => {
    expect(await resolvePath('.nuxt/app.config')).toBe(resolve('.nuxt/app.config.mjs'))
  })
})

describe('resolveNuxtModule', () => {
  it('should resolve Nuxt module paths correctly', async () => {
    const installedModulePaths = nuxt.options._installedModules.map(m => m.meta?.rawPath || m.entryPath!).filter(Boolean)
    expect(installedModulePaths).toMatchInlineSnapshot(`
      [
        "@nuxt/devtools",
        "@nuxt/telemetry",
      ]
    `)

    const resolved = await resolveNuxtModule(withTrailingSlash(nuxt.options.rootDir), [
      ...installedModulePaths,
      '@nuxt/test-utils/module',
    ])

    expect(resolved.length).toBe(3)

    for (const path of resolved) {
      expect(await stat(path).then(r => r.isDirectory() && path.endsWith('node_modules/')).catch(() => false)).toBe(true)
    }
  })
})

describe('findPath', () => {
  it('should find paths correctly', async () => {
    expect(await findPath(resolve(nuxt.options.buildDir, 'my-template'), { virtual: true })).toBe(resolve(nuxt.options.buildDir, 'my-template.mjs'))
  })
})
