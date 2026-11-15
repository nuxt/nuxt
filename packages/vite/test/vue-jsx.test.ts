import { describe, expect, it, vi } from 'vitest'
import vueJsx from '@vitejs/plugin-vue-jsx'
import type { Options } from '@vitejs/plugin-vue-jsx'
import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'

import { DecoratorsPlugin } from '../src/plugins/decorators.ts'
import { VueJsxPlugin } from '../src/plugins/vue-jsx.ts'

const handler = (plugin: Plugin, name: 'config' | 'configResolved' | 'transform' | 'resolveId' | 'load') => {
  const hook = plugin[name] as any
  return (typeof hook === 'function' ? hook : hook.handler) as (...args: any[]) => any
}

const resolvedConfig = (command: 'build' | 'serve') => ({ command, isProduction: command === 'build', root: '/root', build: { sourcemap: false } })

const code = `import { defineComponent } from 'vue'\nexport default defineComponent({ setup: () => () => <div class="a">{1 as number}</div> })\n`

describe('vue-jsx', () => {
  it.each<Options>([{}, { tsTransform: 'built-in' }, { include: [/\.jsx$/, '**/*.tsx'], exclude: /skip/ }])('should match `@vitejs/plugin-vue-jsx` (%o)', async (options) => {
    const real = vueJsx(options) as Plugin
    const lazy = VueJsxPlugin(options)
    const context = { meta: { rolldownVersion: '1.0.0' } }

    expect(lazy.name).toBe(real.name)
    expect(handler(lazy, 'config').call(context, { define: { __VUE_OPTIONS_API__: 'false' } })).toEqual(handler(real, 'config').call(context, { define: { __VUE_OPTIONS_API__: 'false' } }))
    expect((lazy.transform as any).order).toBe((real.transform as any).order)
    expect((lazy.transform as any).filter).toEqual((real.transform as any).filter)
    for (const hook of ['resolveId', 'load'] as const) {
      for (const id of ['/__vue-jsx-ssr-register-helper', '/__vue-jsx-ssr-register-helper?x', '/__vue_jsx_ssr_register_helper']) {
        expect((lazy[hook] as any).filter.id.test(id)).toBe((real[hook] as any).filter.id.test(id))
      }
    }

    for (const [command, ssr] of [['build', false], ['build', true], ['serve', false]] as const) {
      const real = vueJsx(options) as Plugin
      const lazy = VueJsxPlugin(options)
      handler(real, 'configResolved')(resolvedConfig(command))
      handler(lazy, 'configResolved')(resolvedConfig(command))
      const expected = await handler(real, 'transform').call({}, code, '/root/a.tsx', { ssr })
      expect(await handler(lazy, 'transform').call({}, code, '/root/a.tsx', { ssr })).toEqual(expected)
    }
  })

  it('should not import `@vitejs/plugin-vue-jsx` until a module is transformed', async () => {
    const imported = vi.fn()
    vi.resetModules()
    vi.doMock('@vitejs/plugin-vue-jsx', (importOriginal) => {
      imported()
      return importOriginal()
    })
    const { VueJsxPlugin } = await import('../src/plugins/vue-jsx.ts')
    const lazy = VueJsxPlugin()
    handler(lazy, 'config').call({ meta: { rolldownVersion: '1.0.0' } }, {})
    handler(lazy, 'configResolved')(resolvedConfig('build'))
    expect(imported).not.toHaveBeenCalled()

    await handler(lazy, 'transform').call({}, code, '/root/a.tsx', { ssr: false })
    expect(imported).toHaveBeenCalledTimes(1)
    vi.doUnmock('@vitejs/plugin-vue-jsx')
  })

  it('should apply a config resolved after the plugin is imported', async () => {
    const real = vueJsx() as Plugin
    const lazy = VueJsxPlugin()
    handler(real, 'configResolved')(resolvedConfig('build'))
    handler(lazy, 'configResolved')(resolvedConfig('build'))
    await handler(lazy, 'transform').call({}, code, '/root/a.tsx', { ssr: false })

    handler(real, 'configResolved')(resolvedConfig('serve'))
    await handler(lazy, 'configResolved')(resolvedConfig('serve'))
    const expected = await handler(real, 'transform').call({}, code, '/root/a.tsx', { ssr: false })
    expect(await handler(lazy, 'transform').call({}, code, '/root/a.tsx', { ssr: false })).toEqual(expected)
  })

  it('should resolve and load the ssr register helper', async () => {
    const real = vueJsx() as Plugin
    const lazy = VueJsxPlugin()
    const id = '/__vue-jsx-ssr-register-helper'
    expect(await handler(lazy, 'resolveId').call({}, id)).toBe(await handler(real, 'resolveId').call({}, id))
    expect(await handler(lazy, 'load').call({}, id)).toBe(await handler(real, 'load').call({}, id))
  })
})

describe('vue-jsx with decorators', () => {
  const createNuxt = () => ({ options: { experimental: { decorators: true }, rootDir: import.meta.dirname, modulesDir: [] } }) as unknown as Nuxt

  function createTransform (decorators: boolean, options?: Options) {
    const plugin = VueJsxPlugin(options, decorators)
    handler(plugin, 'configResolved')(resolvedConfig('build'))
    return (code: string, id: string, ssr = false) => handler(plugin, 'transform').call({}, code, id, { ssr }) as Promise<{ code: string } | undefined>
  }

  async function lowerDecorators (code: string, id: string) {
    const plugin = DecoratorsPlugin(createNuxt())
    await (plugin.applyToEnvironment as () => Promise<boolean>)()
    return handler(plugin, 'transform').call({}, code, id) as { code: string } | undefined
  }

  const component = [
    'function something<T> () { return (_method: () => unknown) => () => \'decorated\' as T }',
    'class SomeClass { @something<string>() someMethod () { return \'initial\' } }',
    'export default defineComponent({ render: () => <div>{new SomeClass().someMethod()}</div> })',
  ].join('\n')

  const jsxComponent = [
    'function something (_method) { return () => \'decorated\' }',
    'class SomeClass { @something someMethod () { return \'initial\' } }',
    'export default defineComponent({ render: () => <div>{new SomeClass().someMethod()}</div> })',
  ].join('\n')

  const serverHandler = [
    'function something (_method: () => unknown) { return () => \'decorated\' }',
    'class SomeClass { @something someMethod () { return \'initial\' } }',
    'export default eventHandler(() => (<div id={new SomeClass().someMethod()} />).props.id)',
  ].join('\n')

  it.for([
    ['a `.tsx` app component', component, '/app/components/Decorated.tsx', false],
    ['a `.jsx` app component', jsxComponent, '/app/components/Decorated.jsx', false],
    ['a `.tsx` server handler', serverHandler, '/server/api/decorated.tsx', true],
  ] as const)('compiles JSX in %s with decorators', async ([_, code, id, ssr]) => {
    const result = await createTransform(true)(code, id, ssr)
    expect(result!.code).not.toContain('<div')

    const lowered = await lowerDecorators(result!.code, id)
    expect(lowered!.code).not.toContain('@something')
  })

  it('runs user Babel plugins alongside decorators parsing', async () => {
    const userPlugin = () => ({
      visitor: {
        StringLiteral (path: { node: { value: string } }) {
          if (path.node.value === 'initial') {
            path.node.value = 'from-user-plugin'
          }
        },
      },
    })
    const options = { babelPlugins: [userPlugin] }
    const result = await createTransform(true, options)(component, '/app/components/Decorated.tsx')
    expect(result!.code).toContain('from-user-plugin')
    expect(options.babelPlugins).toEqual([userPlugin])
  })

  it('keeps user Babel plugins that already enable a decorators syntax', async () => {
    const legacyDecorators = () => ({
      manipulateOptions (_options: unknown, parserOpts: { plugins: string[] }) {
        parserOpts.plugins.push('decorators-legacy')
      },
    })
    const options = { babelPlugins: [legacyDecorators] }
    const result = await createTransform(true, options)(component, '/app/components/Decorated.tsx')
    expect(result!.code).toContain('@something()')
    expect(options.babelPlugins).toEqual([legacyDecorators])
  })

  it('does not parse decorators when `experimental.decorators` is disabled', async () => {
    await expect(createTransform(false)(component, '/app/components/Decorated.tsx')).rejects.toThrow('decorators')
  })
})
