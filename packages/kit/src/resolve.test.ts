import { describe, expect, it } from 'vitest'
import { resolve } from 'pathe'
import { loadNuxt } from './loader/nuxt'
import { findPath, resolvePath } from './resolve'
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
    expect(await resolvePath('.nuxt/app.config')).toBe(resolve(nuxt.options.buildDir, 'app.config'))
  })
})

describe('findPath', () => {
  it('should find paths correctly', async () => {
    expect(await findPath(resolve(nuxt.options.buildDir, 'my-template'), { virtual: true })).toBe(resolve(nuxt.options.buildDir, 'my-template.mjs'))
  })
})
