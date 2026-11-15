import { describe, expect, it, vi } from 'vitest'
import vueJsx from '@vitejs/plugin-vue-jsx'
import type { Options } from '@vitejs/plugin-vue-jsx'
import type { Plugin } from 'vite'

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
