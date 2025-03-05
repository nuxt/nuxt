import { describe, expect, it } from 'vitest'
import { kebabCase, pascalCase } from 'scule'
import { rollup } from 'rollup'
import vuePlugin from '@vitejs/plugin-vue'
import vuePluginJsx from '@vitejs/plugin-vue-jsx'
import type { AddComponentOptions } from '@nuxt/kit'

import { LoaderPlugin } from '../src/components/plugins/loader'
import { LazyHydrationTransformPlugin } from '../src/components/plugins/lazy-hydration-transform'
import { LazyHydrationMacroTransformPlugin } from '../src/components/plugins/lazy-hydration-macro-transform'

describe('lazy hydration macro transform', () => {
  it ('should correctly transform lazy hydration macro in sfc', async () => {
    const sfc = `
    <script setup>
    const MacroLazyVisibleMyComponent = defineLazyVisibleComponent(() => import('~/components/MyComponent.vue'))
    const MacroLazyIdleMyComponent = defineLazyIdleComponent(() => import('~/components/MyComponent.vue'))
    const MacroLazyInteractionMyComponent = defineLazyInteractionComponent(() => import('~/components/MyComponent.vue'))
    const MacroLazyMediaQueryMyComponent = defineLazyMediaQueryComponent(() => import('~/components/MyComponent.vue'))
    const MacroLazyIfMyComponent = defineLazyIfComponent(() => import('~/components/MyComponent.vue'))
    const MacroLazyTimeMyComponent = defineLazyTimeComponent(() => import('~/components/MyComponent.vue'))
    const MacroLazyNeverMyComponent = defineLazyNeverComponent(() => import('~/components/MyComponent.vue'))
    </script>

    <template>
      <MacroLazyVisibleMyComponent />
      <MacroLazyIdleMyComponent />
      <MacroLazyInteractionMyComponent />
      <MacroLazyMediaQueryMyComponent />
      <MacroLazyIfMyComponent />
      <MacroLazyTimeMyComponent />
      <MacroLazyNeverMyComponent />
    </template>
    `

    const code = await transform(sfc, '/pages/index.vue')
    expect(code).toContain(`import { createLazyVisibleComponent, createLazyIdleComponent, createLazyInteractionComponent, createLazyMediaQueryComponent, createLazyIfComponent, createLazyTimeComponent, createLazyNeverComponent } from '../client-runtime.mjs';`)

    const components = code.split('\n').map(line => line.trim()).filter(line => line.startsWith('const MacroLazy')).join('\n')
    expect(components).toMatchInlineSnapshot(`
      "const MacroLazyVisibleMyComponent = createLazyVisibleComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const MacroLazyIdleMyComponent = createLazyIdleComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const MacroLazyInteractionMyComponent = createLazyInteractionComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const MacroLazyMediaQueryMyComponent = createLazyMediaQueryComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const MacroLazyIfMyComponent = createLazyIfComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const MacroLazyTimeMyComponent = createLazyTimeComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const MacroLazyNeverMyComponent = createLazyNeverComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));"
    `)
  })

  it ('should correctly transform lazy hydration macro in jsx', async () => {
    const component = `
    import { defineComponent } from 'vue'
    export default defineComponent({
      setup () {
        const MacroLazyVisibleMyComponent = defineLazyVisibleComponent(() => import('~/components/MyComponent.vue'))
        const MacroLazyIdleMyComponent = defineLazyIdleComponent(() => import('~/components/MyComponent.vue'))
        const MacroLazyInteractionMyComponent = defineLazyInteractionComponent(() => import('~/components/MyComponent.vue'))
        const MacroLazyMediaQueryMyComponent = defineLazyMediaQueryComponent(() => import('~/components/MyComponent.vue'))
        const MacroLazyIfMyComponent = defineLazyIfComponent(() => import('~/components/MyComponent.vue'))
        const MacroLazyTimeMyComponent = defineLazyTimeComponent(() => import('~/components/MyComponent.vue'))
        const MacroLazyNeverMyComponent = defineLazyNeverComponent(() => import('~/components/MyComponent.vue'))

        return () => <>
          <MacroLazyVisibleMyComponent />
          <MacroLazyIdleMyComponent />
          <MacroLazyInteractionMyComponent />
          <MacroLazyMediaQueryMyComponent />
          <MacroLazyIfMyComponent />
          <MacroLazyTimeMyComponent />
          <MacroLazyNeverMyComponent />
        </>
      }
    })
    `

    const code = await transform(component, '/pages/index.tsx')
    expect(code).toContain(`import { createLazyVisibleComponent, createLazyIdleComponent, createLazyInteractionComponent, createLazyMediaQueryComponent, createLazyIfComponent, createLazyTimeComponent, createLazyNeverComponent } from '../client-runtime.mjs';`)

    const components = code.split('\n').map(line => line.trim()).filter(line => line.startsWith('const MacroLazy')).join('\n')
    expect(components).toMatchInlineSnapshot(`
      "const MacroLazyVisibleMyComponent = createLazyVisibleComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const MacroLazyIdleMyComponent = createLazyIdleComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const MacroLazyInteractionMyComponent = createLazyInteractionComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const MacroLazyMediaQueryMyComponent = createLazyMediaQueryComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const MacroLazyIfMyComponent = createLazyIfComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const MacroLazyTimeMyComponent = createLazyTimeComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const MacroLazyNeverMyComponent = createLazyNeverComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));"
    `)
  })

  it ('should correctly transform lazy hydration macro in ts', async () => {
    const component = `
    import { defineComponent, h } from 'vue'
    export default defineComponent({
      setup () {
        const MacroLazyVisibleMyComponent = defineLazyVisibleComponent(() => import('~/components/MyComponent.vue'))
        const MacroLazyIdleMyComponent = defineLazyIdleComponent(() => import('~/components/MyComponent.vue'))
        const MacroLazyInteractionMyComponent = defineLazyInteractionComponent(() => import('~/components/MyComponent.vue'))
        const MacroLazyMediaQueryMyComponent = defineLazyMediaQueryComponent(() => import('~/components/MyComponent.vue'))
        const MacroLazyIfMyComponent = defineLazyIfComponent(() => import('~/components/MyComponent.vue'))
        const MacroLazyTimeMyComponent = defineLazyTimeComponent(() => import('~/components/MyComponent.vue'))
        const MacroLazyNeverMyComponent = defineLazyNeverComponent(() => import('~/components/MyComponent.vue'))

        return () => h('div', undefined, [
          h(MacroLazyVisibleMyComponent),
          h(MacroLazyIdleMyComponent),
          h(MacroLazyInteractionMyComponent),
          h(MacroLazyMediaQueryMyComponent),
          h(MacroLazyIfMyComponent),
          h(MacroLazyTimeMyComponent),
          h(MacroLazyNeverMyComponent),
        ])
      }
    })
    `

    const code = await transform(component, '/pages/index.tsx')
    expect(code).toContain(`import { createLazyVisibleComponent, createLazyIdleComponent, createLazyInteractionComponent, createLazyMediaQueryComponent, createLazyIfComponent, createLazyTimeComponent, createLazyNeverComponent } from '../client-runtime.mjs';`)

    const components = code.split('\n').map(line => line.trim()).filter(line => line.startsWith('const MacroLazy')).join('\n')
    expect(components).toMatchInlineSnapshot(`
      "const MacroLazyVisibleMyComponent = createLazyVisibleComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const MacroLazyIdleMyComponent = createLazyIdleComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const MacroLazyInteractionMyComponent = createLazyInteractionComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const MacroLazyMediaQueryMyComponent = createLazyMediaQueryComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const MacroLazyIfMyComponent = createLazyIfComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const MacroLazyTimeMyComponent = createLazyTimeComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const MacroLazyNeverMyComponent = createLazyNeverComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));"
    `)
  })
})

async function transform (code: string, filename: string) {
  const components = ([{ name: 'MyComponent', filePath: '/components/MyComponent.vue' }] as AddComponentOptions[]).map(opts => ({
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

  const bundle = await rollup({
    input: filename,
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
      LazyHydrationTransformPlugin({ getComponents: () => components }).rollup(),
      vuePlugin(),
      vuePluginJsx(),
      LoaderPlugin({
        clientDelayedComponentRuntime: '/client-runtime.mjs',
        serverComponentRuntime: '/server-runtime.mjs',
        getComponents: () => components,
        srcDir: '/',
        mode: 'server',
      }).rollup(),
      LazyHydrationMacroTransformPlugin({
        clientDelayedComponentRuntime: '/client-runtime.mjs',
        getComponents: () => components,
        srcDir: '/',
      }).rollup(),
    ],
  })
  const { output: [chunk] } = await bundle.generate({})
  return chunk.code.trim()
}
