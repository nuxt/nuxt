import { describe, expect, it, vi } from 'vitest'
import { _createLazyPlugin, applyPlugins } from '#app/nuxt'
import { defineNuxtPlugin } from '#app'

vi.mock('#app', async (original) => {
  return {
    ...(await original<typeof import('#app')>()),
    applyPlugin: vi.fn(async (_nuxtApp, plugin) => {
      await plugin()
    }),
  }
})

function pluginFactory (name: string, dependsOn: string[] | undefined, sequence: string[], parallel = true) {
  return defineNuxtPlugin({
    name,
    // @ts-expect-error we have a strong type for plugin names
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
        name: 'some plugin',
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
        name: 'some plugin',
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

  it('relying on plugin not registered yet', async () => {
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

describe('lazy plugins', () => {
  describe('_createLazyPlugin wrapper', () => {
    it('returns a plugin with parallel: true', () => {
      const plugin = _createLazyPlugin(() => Promise.resolve({ default: defineNuxtPlugin(() => {}) }), 'analytics')
      expect(plugin.parallel).toBe(true)
    })

    it('sets _name with lazy: prefix', () => {
      const plugin = _createLazyPlugin(() => Promise.resolve({ default: defineNuxtPlugin(() => {}) }), 'my-analytics')
      expect(plugin._name).toBe('lazy:my-analytics')
    })

    it('defaults _name to lazy:unknown when no name provided', () => {
      const plugin = _createLazyPlugin(() => Promise.resolve({ default: defineNuxtPlugin(() => {}) }))
      expect(plugin._name).toBe('lazy:unknown')
    })

    it('is a valid NuxtPlugin indicator', () => {
      const plugin = _createLazyPlugin(() => Promise.resolve({ default: defineNuxtPlugin(() => {}) }))
      expect(typeof plugin).toBe('function')
    })
  })

  describe('deferred execution', () => {
    it('does NOT call loader during applyPlugins', async () => {
      const nuxtApp = useNuxtApp()
      const loader = vi.fn(() => Promise.resolve({ default: defineNuxtPlugin(() => {}) }))
      const plugin = _createLazyPlugin(loader, 'deferred')

      await applyPlugins(nuxtApp, [plugin])

      expect(loader).not.toHaveBeenCalled()
    })

    it('does NOT run setup during applyPlugins', async () => {
      const nuxtApp = useNuxtApp()
      const setup = vi.fn()
      const loader = vi.fn(() => Promise.resolve({ default: defineNuxtPlugin(setup) }))
      const plugin = _createLazyPlugin(loader, 'deferred')

      await applyPlugins(nuxtApp, [plugin])

      expect(setup).not.toHaveBeenCalled()
    })

    it('executes loader after app:suspense:resolve', async () => {
      const nuxtApp = useNuxtApp()
      const setup = vi.fn()
      const loader = vi.fn(() => Promise.resolve({ default: defineNuxtPlugin(setup) }))
      const plugin = _createLazyPlugin(loader, 'post-hydration')

      await applyPlugins(nuxtApp, [plugin])
      expect(loader).not.toHaveBeenCalled()

      await nuxtApp.hooks.callHook('app:suspense:resolve')
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(loader).toHaveBeenCalledOnce()
      expect(setup).toHaveBeenCalledOnce()
    })

    it('executes object-syntax plugin setup after app:suspense:resolve', async () => {
      const nuxtApp = useNuxtApp()
      const setup = vi.fn()
      const loader = vi.fn(() => Promise.resolve({
        default: defineNuxtPlugin({ name: 'obj-lazy', setup }),
      }))
      const plugin = _createLazyPlugin(loader, 'obj-lazy')

      await applyPlugins(nuxtApp, [plugin])
      await nuxtApp.hooks.callHook('app:suspense:resolve')
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(setup).toHaveBeenCalledOnce()
    })

    it('only fires once even if app:suspense:resolve is called multiple times', async () => {
      const nuxtApp = useNuxtApp()
      const loader = vi.fn(() => Promise.resolve({ default: defineNuxtPlugin(() => {}) }))
      const plugin = _createLazyPlugin(loader, 'once')

      await applyPlugins(nuxtApp, [plugin])
      await nuxtApp.hooks.callHook('app:suspense:resolve')
      await nuxtApp.hooks.callHook('app:suspense:resolve')
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(loader).toHaveBeenCalledOnce()
    })
  })

  describe('does not block other plugins', () => {
    it('runs alongside normal plugins without blocking', async () => {
      const nuxtApp = useNuxtApp()
      const sequence: string[] = []

      const lazyPlugin = _createLazyPlugin(() => {
        sequence.push('lazy-loaded')
        return Promise.resolve({ default: defineNuxtPlugin(() => { sequence.push('lazy-setup') }) })
      }, 'lazy')

      const normalPlugin = defineNuxtPlugin({
        name: 'normal',
        setup () { sequence.push('normal-setup') },
      })

      await applyPlugins(nuxtApp, [lazyPlugin, normalPlugin])

      // Normal plugin runs, lazy does not
      expect(sequence).toEqual(['normal-setup'])
    })
  })

  describe('error handling', () => {
    it('triggers app:error hook on loader failure', async () => {
      const nuxtApp = useNuxtApp()
      const errorHandler = vi.fn()
      nuxtApp.hooks.hook('app:error', errorHandler)

      const error = new Error('chunk load failed')
      const plugin = _createLazyPlugin(() => Promise.reject(error), 'broken')

      await applyPlugins(nuxtApp, [plugin])
      await nuxtApp.hooks.callHook('app:suspense:resolve')
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(errorHandler).toHaveBeenCalledWith(error)
    })

    it('triggers app:error hook when plugin setup throws', async () => {
      const nuxtApp = useNuxtApp()
      const errorHandler = vi.fn()
      nuxtApp.hooks.hook('app:error', errorHandler)

      const error = new Error('setup crashed')
      const plugin = _createLazyPlugin(() => Promise.resolve({
        default: defineNuxtPlugin(() => { throw error }),
      }), 'crasher')

      await applyPlugins(nuxtApp, [plugin])
      await nuxtApp.hooks.callHook('app:suspense:resolve')
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(errorHandler).toHaveBeenCalledWith(error)
    })
  })

  describe('edge cases', () => {
    it('multiple lazy plugins each defer independently', async () => {
      const nuxtApp = useNuxtApp()
      const sequence: string[] = []

      const lazyA = _createLazyPlugin(() => Promise.resolve({
        default: defineNuxtPlugin(() => { sequence.push('lazy-A') }),
      }), 'A')
      const lazyB = _createLazyPlugin(() => Promise.resolve({
        default: defineNuxtPlugin(() => { sequence.push('lazy-B') }),
      }), 'B')

      await applyPlugins(nuxtApp, [lazyA, lazyB])
      expect(sequence).toEqual([])

      await nuxtApp.hooks.callHook('app:suspense:resolve')
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(sequence).toContain('lazy-A')
      expect(sequence).toContain('lazy-B')
    })

    it('lazy plugin _name is not resolvable as dependsOn target', async () => {
      const nuxtApp = useNuxtApp()
      const sequence: string[] = []

      const lazyPlugin = _createLazyPlugin(() => Promise.resolve({
        default: defineNuxtPlugin(() => { sequence.push('lazy') }),
      }), 'lazy-dep')

      // Plugin B depends on 'lazy:lazy-dep' — but lazy plugins run outside the pipeline,
      // so B should execute without waiting (dependsOn can't find the name)
      const pluginB = defineNuxtPlugin({
        name: 'B',
        // @ts-expect-error testing invalid dependsOn
        dependsOn: ['lazy:lazy-dep'],
        setup () { sequence.push('B') },
        parallel: true,
      })

      await applyPlugins(nuxtApp, [lazyPlugin, pluginB])
      // B should not be blocked — lazy:lazy-dep is never "resolved" by applyPlugins
      // since the lazy wrapper doesn't resolve plugin names in the pipeline
      expect(sequence).toContain('B')
    })

    it('handles module default that is a plain function (not defineNuxtPlugin)', async () => {
      const nuxtApp = useNuxtApp()
      const setup = vi.fn()

      // Simulates a plugin file that exports a bare function
      const plugin = _createLazyPlugin(() => Promise.resolve({
        default: setup as any,
      }), 'bare-fn')

      await applyPlugins(nuxtApp, [plugin])
      await nuxtApp.hooks.callHook('app:suspense:resolve')
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(setup).toHaveBeenCalledOnce()
    })

    it('lazy plugins mixed with sequential and parallel normal plugins', async () => {
      const nuxtApp = useNuxtApp()
      const sequence: string[] = []

      const seqPlugin = defineNuxtPlugin({
        name: 'seq',
        async setup () {
          sequence.push('start seq')
          await new Promise(resolve => setTimeout(resolve, 10))
          sequence.push('end seq')
        },
      })

      const lazyPlugin = _createLazyPlugin(() => Promise.resolve({
        default: defineNuxtPlugin(() => { sequence.push('lazy') }),
      }), 'lazy')

      const parallelPlugin = defineNuxtPlugin({
        name: 'par',
        parallel: true,
        async setup () {
          sequence.push('start par')
          await new Promise(resolve => setTimeout(resolve, 5))
          sequence.push('end par')
        },
      })

      await applyPlugins(nuxtApp, [seqPlugin, lazyPlugin, parallelPlugin])

      // Lazy should not appear, sequential should complete before parallel starts
      expect(sequence).toEqual(['start seq', 'end seq', 'start par', 'end par'])

      await nuxtApp.hooks.callHook('app:suspense:resolve')
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(sequence).toContain('lazy')
    })
  })
})

describe('plugin hooks', () => {
  it('registers hooks before executing plugins', async () => {
    const nuxtApp = useNuxtApp()

    const sequence: string[] = []
    const plugins = [
      defineNuxtPlugin({
        name: 'A',
        setup (nuxt) {
          sequence.push('start A')
          nuxt.callHook('a:setup')
        },
      }),
      defineNuxtPlugin({
        name: 'B',
        hooks: {
          'a:setup': () => {
            sequence.push('listen B')
          },
        },
      }),
    ]

    await applyPlugins(nuxtApp, plugins)
    expect(sequence).toMatchObject([
      'start A',
      'listen B',
    ])
  })
})
