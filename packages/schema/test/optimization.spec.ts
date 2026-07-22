import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyDefaults } from 'untyped'

import { NuxtConfigSchema } from '../src/index.ts'
import type { NuxtOptions } from '../src/index.ts'

describe('optimization keyed function options', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([4, 5] as const)('supports both the new and the deprecated options with compatibilityVersion %i', async (compatibilityVersion) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await applyDefaults(NuxtConfigSchema, {
      future: { compatibilityVersion },
      optimization: {
        keyedFunctions: [{ name: 'useCustom', source: '~/composables/custom', argumentLength: 2 }],
        keyedComposables: [{ name: 'useLegacy', source: '~/composables/legacy', argumentLength: 2 }],
        keyedFunctionFactories: [{ name: 'createUseCustom', source: '~/composables/custom', argumentLength: 2 }],
        keyedComposableFactories: [{ name: 'createUseLegacy', source: '~/composables/legacy', argumentLength: 2 }],
      },
    }) as unknown as NuxtOptions

    expect(result.optimization.keyedFunctions.map(f => f.name)).toContain('useCustom')
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(result.optimization.keyedComposables.map(f => f.name)).toContain('useLegacy')
    expect(result.optimization.keyedFunctionFactories.map(f => f.name)).toContain('createUseCustom')
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(result.optimization.keyedComposableFactories.map(f => f.name)).toContain('createUseLegacy')
  })

  it('warns when the deprecated options are provided with compatibilityVersion 5', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await applyDefaults(NuxtConfigSchema, {
      future: { compatibilityVersion: 5 },
      optimization: {
        keyedComposables: [{ name: 'useLegacy', source: '~/composables/legacy', argumentLength: 2 }],
        keyedComposableFactories: [{ name: 'createUseLegacy', source: '~/composables/legacy', argumentLength: 2 }],
      },
    })

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`optimization.keyedComposables` is deprecated'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`optimization.keyedComposableFactories` is deprecated'))
  })

  it('does not warn about the deprecated options with compatibilityVersion 4', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await applyDefaults(NuxtConfigSchema, {
      future: { compatibilityVersion: 4 },
      optimization: {
        keyedComposables: [{ name: 'useLegacy', source: '~/composables/legacy', argumentLength: 2 }],
        keyedComposableFactories: [{ name: 'createUseLegacy', source: '~/composables/legacy', argumentLength: 2 }],
      },
    })

    expect(warn).not.toHaveBeenCalled()
  })
})
