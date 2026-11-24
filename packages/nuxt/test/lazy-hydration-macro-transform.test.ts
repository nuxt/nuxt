import { describe, expect, it } from 'vitest'
import { kebabCase, pascalCase } from 'scule'
import { rolldown } from 'rolldown'
import vuePlugin from '@vitejs/plugin-vue'
import vuePluginJsx from '@vitejs/plugin-vue-jsx'
import type { AddComponentOptions } from '@nuxt/kit'

import { LoaderPlugin } from '../src/components/plugins/loader.ts'
import { LazyHydrationTransformPlugin } from '../src/components/plugins/lazy-hydration-transform.ts'
import { LazyHydrationMacroTransformPlugin } from '../src/components/plugins/lazy-hydration-macro-transform.ts'

const strategies = ['Visible', 'Idle', 'Interaction', 'MediaQuery', 'If', 'Time', 'Never']
const declarations = strategies
  .map(strategy => `const LazyHydration${strategy}MyComponent = defineLazyHydrationComponent('${strategy[0]!.toLowerCase()}${strategy.slice(1)}', () => import('~/components/MyComponent.vue'))`)
  .join('\n')

function getLazyDeclarations (code: string) {
  return code.split('\n').map(line => line.trim()).filter(line => line.startsWith('const LazyHydration'))
}

describe('lazy hydration macro transform', () => {
  it.each([
    ['an SFC', '/pages/index.vue', `<script setup>\n${declarations}\n</script>\n<template>\n${strategies.map(strategy => `<LazyHydration${strategy}MyComponent />`).join('\n')}\n</template>`],
    ['JSX', '/pages/index.tsx', `import { defineComponent } from 'vue'\nexport default defineComponent({\n  setup () {\n${declarations}\n    return () => <>${strategies.map(strategy => `<LazyHydration${strategy}MyComponent />`).join('')}</>\n  }\n})`],
    ['render functions', '/pages/index.ts', `import { defineComponent, h } from 'vue'\nexport default defineComponent({\n  setup () {\n${declarations}\n    return () => h('div', undefined, [${strategies.map(strategy => `h(LazyHydration${strategy}MyComponent)`).join(', ')}])\n  }\n})`],
  ])('should transform every hydration strategy in %s', async (_, filename, code) => {
    const result = await transform(code, filename)
    expect(result).toContain('from "/client-runtime.mjs"')
    const components = getLazyDeclarations(result)
    expect(components).toHaveLength(strategies.length)
    for (const strategy of strategies) {
      expect(components.join('\n')).toContain(`const LazyHydration${strategy}MyComponent = createLazy${strategy}Component("components/MyComponent.vue"`)
    }
  })

  it('should transform the macro for components that are not auto-imported', async () => {
    const code = await transform(`<script setup>\nconst LazyHydrationIfMyComponent = defineLazyHydrationComponent('if', () => import('~/components/MyComponent.vue'))\n</script>\n<template><LazyHydrationIfMyComponent /></template>`, '/pages/index.vue', true)
    expect(code).toContain(`import { createLazyIfComponent } from "/client-runtime.mjs";`)
    expect(getLazyDeclarations(code)).toEqual([`const LazyHydrationIfMyComponent = createLazyIfComponent("components/MyComponent.vue", () => import("~/components/MyComponent.vue"));`])
  })

  it.each([
    ['a block statement', `() => {\n  // Some comment\n  return import('~/components/MyComponent.vue')\n}`],
    ['an async arrow function', `async () => await import('~/components/MyComponent.vue')`],
    ['an async block statement', `async () => {\n  return await import('~/components/MyComponent.vue')\n}`],
    ['a parenthesized import', `() => (import('~/components/MyComponent.vue'))`],
    ['a parenthesized import in a block statement', `() => {\n  return (import('~/components/MyComponent.vue'))\n}`],
    ['method chaining', `() => import('~/components/MyComponent.vue').then(m => m.default)`],
    ['a conditional expression', `() =>\n  process.env.NODE_ENV === 'development'\n    ? import('~/components/MyComponent.vue')\n    : import('~/components/MyComponent.vue')`],
    ['a complex nested pattern', `async () => {\n  return await (import('~/components/MyComponent.vue')).then(m => m.default)\n}`],
  ])('should handle a loader written as %s', async (_, loader) => {
    const code = await transform(`<script setup>\nconst LazyHydrationVisibleMyComponent = defineLazyHydrationComponent('visible', ${loader})\n</script>\n<template><LazyHydrationVisibleMyComponent /></template>`, '/pages/index.vue')
    expect(code).toContain(`import { createLazyVisibleComponent } from "/client-runtime.mjs";`)
    expect(getLazyDeclarations(code).join('\n')).toContain(`const LazyHydrationVisibleMyComponent = createLazyVisibleComponent("components/MyComponent.vue"`)
  })
})

async function transform (code: string, filename: string, noComponents?: boolean) {
  const components = noComponents
    ? []
    : ([{ name: 'MyComponent', filePath: '/components/MyComponent.vue' }] as AddComponentOptions[]).map(opts => ({
        export: opts.export || 'default',
        chunkName: 'components/' + kebabCase(opts.name),
        global: opts.global ?? false,
        kebabName: kebabCase(opts.name || ''),
        pascalName: pascalCase(opts.name || ''),
        prefetch: false,
        preload: false,
        mode: 'all' as const,
        shortPath: opts.filePath,
        priority: 0,
        meta: {},
        ...opts,
      }))

  const bundle = await rolldown({
    input: filename,
    external: id => id !== filename,
    plugins: [
      {
        name: 'entry',
        resolveId (id) {
          if (id === filename) {
            return id
          }
        },
        load (id) {
          if (id === filename) {
            return code
          }
        },
      },
      LazyHydrationTransformPlugin({ getComponents: () => components }).rolldown(),
      vuePlugin(),
      vuePluginJsx(),
      LoaderPlugin({
        clientDelayedComponentRuntime: '/client-runtime.mjs',
        serverComponentRuntime: '/server-runtime.mjs',
        getComponents: () => components,
        srcDir: '/',
        mode: 'server',
      }).rolldown(),
      LazyHydrationMacroTransformPlugin({
        clientDelayedComponentRuntime: '/client-runtime.mjs',
        srcDir: '/',
        alias: {
          '~/': '/',
        },
      }).rolldown(),
    ],
  })
  const { output: [chunk] } = await bundle.generate({})
  return chunk.code.trim()
}
