import { describe, expect, it, vi } from 'vitest'
import { applyPlugins } from '#app/nuxt'
import { defineNuxtPlugin } from '#app'

vi.mock('#app', async (original) => {
  return {
    ...(await original<typeof import('#app')>()),
    applyPlugin: vi.fn(async (_nuxtApp, plugin) => {
      await plugin()
    }),
  }
})

function pluginFactory (name: string, dependsOn?: string[], sequence: string[], parallel = true) {
  return defineNuxtPlugin({
    name,
    dependsOn,
    async setup () {
      sequence.push(`start ${name}`)
      await new Promise(resolve => setTimeout(resolve, 10))
      sequence.push(`end ${name}`)
    },
    parallel,
  })
}

describe('plugin dependsOn', () => {
  it('expect B to await A to finish before being run', async () => {
    const nuxtApp = useNuxtApp()
    const sequence: string[] = []
    const plugins = [
      pluginFactory('A', undefined, sequence),
      pluginFactory('B', ['A'], sequence),
    ]

    await applyPlugins(nuxtApp, plugins)

    expect(sequence).toMatchObject([
      'start A',
      'end A',
      'start B',
      'end B',
    ])
  })

  it('expect C to await A and B to finish before being run', async () => {
    const nuxtApp = useNuxtApp()
    const sequence: string[] = []
    const plugins = [
      pluginFactory('A', undefined, sequence),
      pluginFactory('B', ['A'], sequence),
      pluginFactory('C', ['A', 'B'], sequence),
    ]

    await applyPlugins(nuxtApp, plugins)

    expect(sequence).toMatchObject([
      'start A',
      'end A',
      'start B',
      'end B',
      'start C',
      'end C',
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
        parallel: true,
      }),
    ]

    await applyPlugins(nuxtApp, plugins)

    expect(sequence).toMatchObject([
      'start A',
      'start C',
      'end C',
      'end A',
      'start B',
      'end B',
    ])
  })

  it('expect C to block the depends on of A-B since C is sequential', async () => {
    const nuxtApp = useNuxtApp()
    const sequence: string[] = []
    const plugins = [
      pluginFactory('A', undefined, sequence),
      defineNuxtPlugin({
        name,
        async setup () {
          sequence.push('start C')
          await new Promise(resolve => setTimeout(resolve, 50))
          sequence.push('end C')
        },
      }),
      pluginFactory('B', ['A'], sequence),
    ]

    await applyPlugins(nuxtApp, plugins)

    expect(sequence).toMatchObject([
      'start A',
      'start C',
      'end A',
      'end C',
      'start B',
      'end B',
    ])
  })

  it('relying on plugin not registed yet', async () => {
    const nuxtApp = useNuxtApp()
    const sequence: string[] = []
    const plugins = [
      pluginFactory('C', ['A'], sequence),
      pluginFactory('A', undefined, sequence, true),
      pluginFactory('E', ['B', 'C'], sequence, false),
      pluginFactory('B', undefined, sequence),
      pluginFactory('D', ['C'], sequence, false),
    ]
    await applyPlugins(nuxtApp, plugins)

    expect(sequence).toMatchObject([
      'start A',
      'start B',
      'end A',
      'start C',
      'end B',
      'end C',
      'start E',
      'start D',
      'end E',
      'end D',
    ])
  })

  it('test depending on not yet registered plugin and already resolved plugin', async () => {
    const nuxtApp = useNuxtApp()
    const sequence: string[] = []
    const plugins = [
      pluginFactory('A', undefined, sequence),
      pluginFactory('B', ['A', 'C'], sequence),
      pluginFactory('C', undefined, sequence, false),
      pluginFactory('D', undefined, sequence, false),
      pluginFactory('E', ['C'], sequence, false),
    ]
    await applyPlugins(nuxtApp, plugins)

    expect(sequence).toMatchObject([
      'start A',
      'start C',
      'end A',
      'end C',
      'start B',
      'start D',
      'end B',
      'end D',
      'start E',
      'end E',
    ])
  })

  it('multiple depth of plugin dependency', async () => {
    const nuxtApp = useNuxtApp()
    const sequence: string[] = []
    const plugins = [
      pluginFactory('A', undefined, sequence),
      pluginFactory('C', ['B', 'A'], sequence),
      pluginFactory('B', undefined, sequence, false),
      pluginFactory('E', ['D'], sequence, false),
      pluginFactory('D', ['C'], sequence, false),
    ]
    await applyPlugins(nuxtApp, plugins)

    expect(sequence).toMatchObject([
      'start A',
      'start B',
      'end A',
      'end B',
      'start C',
      'end C',
      'start D',
      'end D',
      'start E',
      'end E',
    ])
  })

  it('does not throw when circular dependency is not a problem', async () => {
    const nuxtApp = useNuxtApp()
    const sequence: string[] = []
    const plugins = [
      pluginFactory('A', ['B'], sequence),
      pluginFactory('B', ['C'], sequence),
      pluginFactory('C', ['D'], sequence),
      pluginFactory('D', [], sequence),
    ]

    await applyPlugins(nuxtApp, plugins)
    expect(sequence).toMatchObject([
      'start D',
      'end D',
      'start C',
      'end C',
      'start B',
      'end B',
      'start A',
      'end A',
    ])
  })

  it('function plugin', async () => {
    const nuxtApp = useNuxtApp()
    const sequence: string[] = []
    const plugins = [
      pluginFactory('A', undefined, sequence),
      defineNuxtPlugin(() => {
        sequence.push('start C')
        sequence.push('end C')
      }),
      pluginFactory('B', undefined, sequence, false),
    ]
    await applyPlugins(nuxtApp, plugins)

    expect(sequence).toMatchObject([
      'start A',
      'start C',
      'end C',
      'start B',
      'end A',
      'end B',
    ])
  })

  it('expect B to execute after A, C when B depends on A and C', async () => {
    const nuxtApp = useNuxtApp()
    const sequence: string[] = []
    const plugins = [
      pluginFactory('A', undefined, sequence, false),
      pluginFactory('B', ['A', 'C'], sequence, false),
      pluginFactory('C', undefined, sequence, false),
    ]
    await applyPlugins(nuxtApp, plugins)

    expect(sequence).toMatchObject([
      'start A',
      'end A',
      'start C',
      'end C',
      'start B',
      'end B',
    ])
  })

  it('expect to execute plugins if a plugin depends on a plugin that does not exist', async () => {
    const nuxtApp = useNuxtApp()
    const sequence: string[] = []
    const plugins = [
      pluginFactory('B', undefined, sequence),
      pluginFactory('C', ['A', 'B'], sequence),
    ]
    await applyPlugins(nuxtApp, plugins)

    expect(sequence).toMatchObject([
      'start B',
      'end B',
      'start C',
      'end C',
    ])
  })
})
