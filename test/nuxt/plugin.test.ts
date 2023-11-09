import { describe, expect, it, vi } from 'vitest'
import { applyPlugins } from '#app/nuxt'
import { defineNuxtPlugin } from '#app'

vi.mock('#app', async (original) => {
  return {
    ...(await original<typeof import('#app')>()),
    applyPlugin: vi.fn(async (_nuxtApp, plugin) => {
      await plugin()
    })
  }
})

function pluginFactory (name: string, dependsOn?: string[], sequence: string[], parallel = true) {
  return defineNuxtPlugin({
    name,
    dependsOn,
    async setup () {
      sequence.push(`start ${name}`)
      await new Promise(resolve => setTimeout(resolve, 40))
      sequence.push(`end ${name}`)
    },
    parallel
  })
}

describe('plugin dependsOn', () => {
  it('expect B to await A to finish before being run', async () => {
    const nuxtApp = useNuxtApp()
    const sequence: string[] = []
    const plugins = [
      pluginFactory('A', undefined, sequence),
      pluginFactory('B', ['A'], sequence)
    ]

    await applyPlugins(nuxtApp, plugins)

    expect(sequence).toMatchObject([
      'start A',
      'end A',
      'start B',
      'end B'
    ])
  })

  it('expect C to await A and B to finish before being run', async () => {
    const nuxtApp = useNuxtApp()
    const sequence: string[] = []
    const plugins = [
      pluginFactory('A', undefined, sequence),
      pluginFactory('B', ['A'], sequence),
      pluginFactory('C', ['A', 'B'], sequence)
    ]

    await applyPlugins(nuxtApp, plugins)

    expect(sequence).toMatchObject([
      'start A',
      'end A',
      'start B',
      'end B',
      'start C',
      'end C'
    ])
  })

  it('expect C to not wait for A to finish before being run', async () => {
    const nuxtApp = useNuxtApp()
    const sequence: string[] = []
    const plugins = [
      pluginFactory('A', undefined, sequence),
      pluginFactory('B', ['A'], sequence),
      defineNuxtPlugin({
        name,
        async setup () {
          sequence.push('start C')
          await new Promise(resolve => setTimeout(resolve, 5))
          sequence.push('end C')
        },
        parallel: true
      })
    ]

    await applyPlugins(nuxtApp, plugins)

    expect(sequence).toMatchObject([
      'start A',
      'start C',
      'end C',
      'end A',
      'start B',
      'end B'
    ])
  })
})
