import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NuxtApp } from '../src/app/nuxt.ts'
import { applyPlugins, defineNuxtPlugin } from '../src/app/nuxt.ts'

describe('plugin dependencies in an island render', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('runs a plugin whose dependency is skipped for islands', async () => {
    vi.stubGlobal('__TEST_SERVER__', true)
    const sequence: string[] = []
    const nuxtApp = {
      ssrContext: { islandContext: {} },
      payload: {},
      runWithContext: (fn: () => unknown) => fn(),
    } as unknown as NuxtApp

    await applyPlugins(nuxtApp, [
      defineNuxtPlugin({
        name: 'A',
        env: { islands: false },
        setup () { sequence.push('A') },
      }),
      defineNuxtPlugin({
        name: 'B',
        dependsOn: ['A'],
        setup () { sequence.push('B') },
      }),
      defineNuxtPlugin({
        name: 'C',
        setup () { sequence.push('C') },
      }),
    ])

    expect(sequence).toEqual(['B', 'C'])
  })
})
