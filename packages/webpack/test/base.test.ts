import { describe, expect, it } from 'vitest'
import { resolve } from 'pathe'
import { getWebpackModulesDir } from '../src/presets/base.ts'

describe('webpack base preset', () => {
  it('includes pnpm hoisted node_modules directories', () => {
    const rootModules = resolve('/project', 'node_modules')
    const layerModules = resolve('/project/layer', 'node_modules')

    expect(getWebpackModulesDir([rootModules, layerModules])).toEqual([
      'node_modules',
      rootModules,
      resolve(rootModules, '.pnpm/node_modules'),
      layerModules,
      resolve(layerModules, '.pnpm/node_modules'),
    ])
  })

  it('deduplicates module lookup paths', () => {
    const rootModules = resolve('/project', 'node_modules')

    expect(getWebpackModulesDir([rootModules, rootModules])).toEqual([
      'node_modules',
      rootModules,
      resolve(rootModules, '.pnpm/node_modules'),
    ])
  })
})
