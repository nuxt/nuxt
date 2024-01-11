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

function pluginFactory (name: string, dependsOn?: string[] | (() => string[]), sequence: string[], parallel = true) {
  return defineNuxtPlugin({
    name,
    dependsOn,
    async setup () {
      sequence.push(`start ${name}`)
      await new Promise(resolve => setTimeout(resolve, 10))
      sequence.push(`end ${name}`)
    },
    parallel
  })
}

describe('plugin dependsOn', () => {
  const testA = (callback: boolean) => {
    return async () => {
      const nuxtApp = useNuxtApp()
      const sequence: string[] = []
      const plugins = [
        pluginFactory('A', undefined, sequence),
        pluginFactory('B', callback ? () => ['A'] : ['A'], sequence)
      ]

      await applyPlugins(nuxtApp, plugins)

      expect(sequence).toMatchObject([
        'start A',
        'end A',
        'start B',
        'end B'
      ])
    }
  }
  it('expect B to await A to finish before being run', testA(false))

  it('expect B to await A to finish before being run (callback)', testA(true))

  const testB = (callback: boolean) => {
    return async () => {
      const nuxtApp = useNuxtApp()
      const sequence: string[] = []
      const plugins = [
        pluginFactory('A', undefined, sequence),
        pluginFactory('B', callback ? () => ['A'] : ['A'], sequence),
        pluginFactory('C', callback ? () => ['A', 'B'] : ['A', 'B'], sequence)
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
    }
  }
  it('expect C to await A and B to finish before being run', testB(false))

  it('expect C to await A and B to finish before being run (callback)', testB(true))

  const testC = (callback: boolean) => {
    return async () => {
      const nuxtApp = useNuxtApp()
      const sequence: string[] = []
      const plugins = [
        pluginFactory('A', undefined, sequence),
        pluginFactory('B', callback ? () => ['A'] : ['A'], sequence),
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
    }
  }
  it('expect C to not wait for A to finish before being run', testC(false))

  it('expect C to not wait for A to finish before being run (callback)', testC(true))

  const testD = (callback: boolean) => {
    return async () => {
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
          }
        }),
        pluginFactory('B', callback ? () => ['A'] : ['A'], sequence)
      ]

      await applyPlugins(nuxtApp, plugins)

      expect(sequence).toMatchObject([
        'start A',
        'start C',
        'end A',
        'end C',
        'start B',
        'end B'
      ])
    }
  }
  it('expect C to block the depends on of A-B since C is sequential', testD(false))

  it('expect C to block the depends on of A-B since C is sequential (callback)', testD(true))

  const testE = (callback: boolean) => {
    return async () => {
      const nuxtApp = useNuxtApp()
      const sequence: string[] = []
      const plugins = [
        pluginFactory('C', callback ? () => ['A'] : ['A'], sequence),
        pluginFactory('A', undefined, sequence, true),
        pluginFactory('E', callback ? () => ['B', 'C'] : ['B', 'C'], sequence, false),
        pluginFactory('B', undefined, sequence),
        pluginFactory('D', callback ? () => ['C'] : ['C'], sequence, false)
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
        'end D'
      ])
    }
  }
  it('relying on plugin not registed yet', testE(false))

  it('relying on plugin not registed yet', testE(true))

  const testF = (callback: boolean) => {
    return async () => {
      const nuxtApp = useNuxtApp()
      const sequence: string[] = []
      const plugins = [
        pluginFactory('A', undefined, sequence),
        pluginFactory('B', callback ? () => ['A', 'C'] : ['A', 'C'], sequence),
        pluginFactory('C', undefined, sequence, false),
        pluginFactory('D', undefined, sequence, false),
        pluginFactory('E', callback ? () => ['C'] : ['C'], sequence, false)
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
        'end E'
      ])
    }
  }
  it('test depending on not yet registered plugin and already resolved plugin', testF(false))

  it('test depending on not yet registered plugin and already resolved plugin (callback)', testF(true))

  const testG = (callback: boolean) => {
    return async () => {
      const nuxtApp = useNuxtApp()
      const sequence: string[] = []
      const plugins = [
        pluginFactory('A', undefined, sequence),
        pluginFactory('C', callback ? () => ['B', 'A'] : ['B', 'A'], sequence),
        pluginFactory('B', undefined, sequence, false),
        pluginFactory('E', callback ? () => ['D'] : ['D'], sequence, false),
        pluginFactory('D', callback ? () => ['C'] : ['C'], sequence, false)
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
        'end E'
      ])
    }
  }
  it('multiple depth of plugin dependency', testG(false))

  it('multiple depth of plugin dependency (callback)', testG(true))

  const testH = (callback: boolean) => {
    return async () => {
      const nuxtApp = useNuxtApp()
      const sequence: string[] = []
      const plugins = [
        pluginFactory('A', callback ? () => ['B'] : ['B'], sequence),
        pluginFactory('B', callback ? () => ['C'] : ['C'], sequence),
        pluginFactory('C', callback ? () => ['D'] : ['D'], sequence),
        pluginFactory('D', callback ? () => [] : [], sequence),
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
        'end A'
      ])
    }
  }
  it('does not throw when circular dependency is not a problem', testH(false))

  it('does not throw when circular dependency is not a problem (callback)', testH(true))

  it('function plugin', async () => {
    const nuxtApp = useNuxtApp()
    const sequence: string[] = []
    const plugins = [
      pluginFactory('A', undefined, sequence),
      defineNuxtPlugin(() => {
        sequence.push('start C')
        sequence.push('end C')
      }),
      pluginFactory('B', undefined, sequence, false)
    ]
    await applyPlugins(nuxtApp, plugins)

    expect(sequence).toMatchObject([
      'start A',
      'start C',
      'end C',
      'start B',
      'end A',
      'end B'
    ])
  })
})
