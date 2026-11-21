import { describe, expect, it } from 'vitest'

import { formatCompilationErrors } from '../src/utils/errors.ts'

const stats = (errors: unknown[]) => ({ toJson: () => ({ errors }) }) as any

describe('formatCompilationErrors', () => {
  it('names each module and its importers without their loader chains', () => {
    expect(formatCompilationErrors(stats([{
      moduleName: '../unplugin/transform.mjs??nuxt:imports!../vue-loader/index.js??ruleSet[0]!./app.vue?vue&type=script',
      loc: '3:0-26',
      message: 'Module not found: Error: Can\'t resolve \'./missing\'',
      moduleTrace: [{ originName: './app.vue' }, { originName: '../unplugin/transform.mjs??nuxt:imports!./entry.ts' }],
    }, {
      message: 'Something without a module',
    }]))).toBe([
      'ERROR in ./app.vue?vue&type=script 3:0-26',
      'Module not found: Error: Can\'t resolve \'./missing\'',
      ' @ ./app.vue',
      ' @ ./entry.ts',
      '',
      'ERROR',
      'Something without a module',
    ].join('\n'))
  })

  it('lists an importer once when consecutive loader chains resolve to the same module', () => {
    expect(formatCompilationErrors(stats([{
      moduleName: './app.vue',
      message: 'Module build failed',
      moduleTrace: [
        { originName: '../vue-loader/index.js??ruleSet[0]!./nuxt-root.vue?vue&type=script' },
        { originName: '../unplugin/transform.mjs??nuxt:imports!./nuxt-root.vue?vue&type=script' },
        { originName: './nuxt-root.vue' },
      ],
    }]))).toBe([
      'ERROR in ./app.vue',
      'Module build failed',
      ' @ ./nuxt-root.vue?vue&type=script',
      ' @ ./nuxt-root.vue',
    ].join('\n'))
  })
})
