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

  it('includes the errors of child compilations', () => {
    const childStats = {
      toJson: (options: { children?: boolean }) => ({
        errors: [],
        children: options.children ? [{ errors: [{ message: 'Failed in a child compilation' }], children: [{ errors: [{ message: 'Failed in a nested child' }] }] }] : undefined,
      }),
    } as any
    expect(formatCompilationErrors(childStats)).toBe([
      'ERROR',
      'Failed in a child compilation',
      '',
      'ERROR',
      'Failed in a nested child',
    ].join('\n'))
  })

  it('names the file of an error that has no module', () => {
    expect(formatCompilationErrors(stats([{ file: 'app/app.vue:3:7', message: 'TS2322: Type \'string\' is not assignable to type \'number\'.' }]))).toBe([
      'ERROR in app/app.vue:3:7',
      'TS2322: Type \'string\' is not assignable to type \'number\'.',
    ].join('\n'))
  })
})
