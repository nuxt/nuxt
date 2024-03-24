import { describe, expect, it } from 'vitest'
import { resolve } from 'pathe'
import { loadNuxt } from './loader/nuxt'
import {
  findPath,
  resolvePath
} from './resolve'
import { defineNuxtModule } from './module/define'
import { addTemplate } from './template'

describe('resolvePath', () => {
  it('should resolve paths correctly', async () => {
    const nuxt = await loadNuxt({})
    expect(await resolvePath('.nuxt/app.config')).toBe(resolve(nuxt.options.buildDir, 'app.config.mjs'))
  })
})

describe('findPath', () => {
  it('should find paths correctly', async () => {
    const nuxt = await loadNuxt({
      overrides: {
        modules: [
          defineNuxtModule(() => {
            addTemplate({
              filename: 'my-template.mjs',
              getContents: () => 'export const myUtil = () => \'hello\''
            })
          })
        ]
      }
    })

    expect(await findPath(resolve(nuxt.options.buildDir, 'my-template.mjs'))).not.toBeNull()
  })
})
