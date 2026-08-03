import { describe, expect, it } from 'vitest'
import { kebabCase, pascalCase } from 'scule'
import { rolldown } from 'rolldown'
import vuePlugin from '@vitejs/plugin-vue'
import vuePluginJsx from '@vitejs/plugin-vue-jsx'
import type { AddComponentOptions } from '@nuxt/kit'

import { LoaderPlugin } from '../src/components/plugins/loader.ts'
import { LazyHydrationTransformPlugin } from '../src/components/plugins/lazy-hydration-transform.ts'
import { LazyHydrationMacroTransformPlugin } from '../src/components/plugins/lazy-hydration-macro-transform.ts'

describe('lazy hydration macro transform', () => {
  it ('should correctly transform lazy hydration macro in sfc', async () => {
    const sfc = `
    <script setup>
    const LazyHydrationVisibleMyComponent = defineLazyHydrationComponent('visible', () => import('~/components/MyComponent.vue'))
    const LazyHydrationIdleMyComponent = defineLazyHydrationComponent('idle', () => import('~/components/MyComponent.vue'))
    const LazyHydrationInteractionMyComponent = defineLazyHydrationComponent('interaction', () => import('~/components/MyComponent.vue'))
    const LazyHydrationMediaQueryMyComponent = defineLazyHydrationComponent('mediaQuery', () => import('~/components/MyComponent.vue'))
    const LazyHydrationIfMyComponent = defineLazyHydrationComponent('if', () => import('~/components/MyComponent.vue'))
    const LazyHydrationTimeMyComponent = defineLazyHydrationComponent('time', () => import('~/components/MyComponent.vue'))
    const LazyHydrationNeverMyComponent = defineLazyHydrationComponent('never', () => import('~/components/MyComponent.vue'))
    </script>

    <template>
      <LazyHydrationVisibleMyComponent />
      <LazyHydrationIdleMyComponent />
      <LazyHydrationInteractionMyComponent />
      <LazyHydrationMediaQueryMyComponent />
      <LazyHydrationIfMyComponent />
      <LazyHydrationTimeMyComponent />
      <LazyHydrationNeverMyComponent />
    </template>
    `

    const code = await transform(sfc, '/pages/index.vue')
    for (const fn of ['createLazyVisibleComponent', 'createLazyIdleComponent', 'createLazyInteractionComponent', 'createLazyMediaQueryComponent', 'createLazyIfComponent', 'createLazyTimeComponent', 'createLazyNeverComponent']) {
      expect(code).toContain(fn)
    }
    expect(code).toContain('from "/client-runtime.mjs"')

    const components = code.split('\n').map(line => line.trim()).filter(line => line.startsWith('const LazyHydration'))
    expect(components).toHaveLength(7)
    expect(components.join('\n')).toContain('createLazyVisibleComponent("components/MyComponent.vue"')
    expect(components.join('\n')).toContain('createLazyIdleComponent("components/MyComponent.vue"')
    expect(components.join('\n')).toContain('createLazyInteractionComponent("components/MyComponent.vue"')
    expect(components.join('\n')).toContain('createLazyMediaQueryComponent("components/MyComponent.vue"')
    expect(components.join('\n')).toContain('createLazyIfComponent("components/MyComponent.vue"')
    expect(components.join('\n')).toContain('createLazyTimeComponent("components/MyComponent.vue"')
    expect(components.join('\n')).toContain('createLazyNeverComponent("components/MyComponent.vue"')
  })

  it ('should correctly transform lazy hydration macro in sfc with non-auto-imported components', async () => {
    const sfc = `
    <script setup>
    const LazyHydrationIfMyComponent = defineLazyHydrationComponent('if', () => import('~/components/MyComponent.vue'))
    </script>

    <template>
      <LazyHydrationIfMyComponent />
    </template>
    `

    const code = await transform(sfc, '/pages/index.vue', true)
    expect(code).toContain(`import { createLazyIfComponent } from "/client-runtime.mjs";`)

    const component = code.split('\n').map(line => line.trim()).find(line => line.startsWith('const LazyHydration'))
    expect(component).toMatchInlineSnapshot(`"const LazyHydrationIfMyComponent = createLazyIfComponent("components/MyComponent.vue", () => import("~/components/MyComponent.vue"));"`)
  })

  it ('should correctly transform lazy hydration macro in jsx', async () => {
    const component = `
    import { defineComponent } from 'vue'
    export default defineComponent({
      setup () {
        const LazyHydrationVisibleMyComponent = defineLazyHydrationComponent('visible', () => import('~/components/MyComponent.vue'))
        const LazyHydrationIdleMyComponent = defineLazyHydrationComponent('idle', () => import('~/components/MyComponent.vue'))
        const LazyHydrationInteractionMyComponent = defineLazyHydrationComponent('interaction', () => import('~/components/MyComponent.vue'))
        const LazyHydrationMediaQueryMyComponent = defineLazyHydrationComponent('mediaQuery', () => import('~/components/MyComponent.vue'))
        const LazyHydrationIfMyComponent = defineLazyHydrationComponent('if', () => import('~/components/MyComponent.vue'))
        const LazyHydrationTimeMyComponent = defineLazyHydrationComponent('time', () => import('~/components/MyComponent.vue'))
        const LazyHydrationNeverMyComponent = defineLazyHydrationComponent('never', () => import('~/components/MyComponent.vue'))

        return () => <>
          <LazyHydrationVisibleMyComponent />
          <LazyHydrationIdleMyComponent />
          <LazyHydrationInteractionMyComponent />
          <LazyHydrationMediaQueryMyComponent />
          <LazyHydrationIfMyComponent />
          <LazyHydrationTimeMyComponent />
          <LazyHydrationNeverMyComponent />
        </>
      }
    })
    `

    const code = await transform(component, '/pages/index.tsx')
    for (const fn of ['createLazyVisibleComponent', 'createLazyIdleComponent', 'createLazyInteractionComponent', 'createLazyMediaQueryComponent', 'createLazyIfComponent', 'createLazyTimeComponent', 'createLazyNeverComponent']) {
      expect(code).toContain(fn)
    }
    expect(code).toContain('from "/client-runtime.mjs"')

    const components = code.split('\n').map(line => line.trim()).filter(line => line.startsWith('const LazyHydration'))
    expect(components).toHaveLength(7)
    expect(components.join('\n')).toContain('createLazyVisibleComponent("components/MyComponent.vue"')
    expect(components.join('\n')).toContain('createLazyNeverComponent("components/MyComponent.vue"')
  })

  it ('should correctly transform lazy hydration macro in ts', async () => {
    const component = `
    import { defineComponent, h } from 'vue'
    export default defineComponent({
      setup () {
        const LazyHydrationVisibleMyComponent = defineLazyHydrationComponent('visible', () => import('~/components/MyComponent.vue'))
        const LazyHydrationIdleMyComponent = defineLazyHydrationComponent('idle', () => import('~/components/MyComponent.vue'))
        const LazyHydrationInteractionMyComponent = defineLazyHydrationComponent('interaction', () => import('~/components/MyComponent.vue'))
        const LazyHydrationMediaQueryMyComponent = defineLazyHydrationComponent('mediaQuery', () => import('~/components/MyComponent.vue'))
        const LazyHydrationIfMyComponent = defineLazyHydrationComponent('if', () => import('~/components/MyComponent.vue'))
        const LazyHydrationTimeMyComponent = defineLazyHydrationComponent('time', () => import('~/components/MyComponent.vue'))
        const LazyHydrationNeverMyComponent = defineLazyHydrationComponent('never', () => import('~/components/MyComponent.vue'))

        return () => h('div', undefined, [
          h(LazyHydrationVisibleMyComponent),
          h(LazyHydrationIdleMyComponent),
          h(LazyHydrationInteractionMyComponent),
          h(LazyHydrationMediaQueryMyComponent),
          h(LazyHydrationIfMyComponent),
          h(LazyHydrationTimeMyComponent),
          h(LazyHydrationNeverMyComponent),
        ])
      }
    })
    `

    const code = await transform(component, '/pages/index.tsx')
    for (const fn of ['createLazyVisibleComponent', 'createLazyIdleComponent', 'createLazyInteractionComponent', 'createLazyMediaQueryComponent', 'createLazyIfComponent', 'createLazyTimeComponent', 'createLazyNeverComponent']) {
      expect(code).toContain(fn)
    }
    expect(code).toContain('from "/client-runtime.mjs"')

    const components = code.split('\n').map(line => line.trim()).filter(line => line.startsWith('const LazyHydration'))
    expect(components).toHaveLength(7)
    expect(components.join('\n')).toContain('createLazyVisibleComponent("components/MyComponent.vue"')
    expect(components.join('\n')).toContain('createLazyNeverComponent("components/MyComponent.vue"')
  })

  it('should handle arrow functions with block statements', async () => {
    const sfc = `
    <script setup>
    const LazyHydrationVisibleMyComponent = defineLazyHydrationComponent('visible', () => {
      return import('~/components/MyComponent.vue')
    })
    const LazyHydrationIdleMyComponent = defineLazyHydrationComponent('idle', () => {
      // Some comment
      return import('~/components/MyComponent.vue')
    })
    </script>

    <template>
      <LazyHydrationVisibleMyComponent />
      <LazyHydrationIdleMyComponent />
    </template>
    `

    const code = await transform(sfc, '/pages/index.vue')
    expect(code).toContain('createLazyVisibleComponent')
    expect(code).toContain('createLazyIdleComponent')
    expect(code).toContain('from "/client-runtime.mjs"')

    const components = code.split('\n').map(line => line.trim()).filter(line => line.startsWith('const LazyHydration')).join('\n')
    expect(components).toContain(`const LazyHydrationVisibleMyComponent = createLazyVisibleComponent("components/MyComponent.vue"`)
    expect(components).toContain(`const LazyHydrationIdleMyComponent = createLazyIdleComponent("components/MyComponent.vue"`)
  })

  it('should handle async/await patterns', async () => {
    const sfc = `
    <script setup>
    const LazyHydrationVisibleMyComponent = defineLazyHydrationComponent('visible', async () => await import('~/components/MyComponent.vue'))
    const LazyHydrationIdleMyComponent = defineLazyHydrationComponent('idle', async () => {
      return await import('~/components/MyComponent.vue')
    })
    </script>

    <template>
      <LazyHydrationVisibleMyComponent />
      <LazyHydrationIdleMyComponent />
    </template>
    `

    const code = await transform(sfc, '/pages/index.vue')
    expect(code).toContain('createLazyVisibleComponent')
    expect(code).toContain('createLazyIdleComponent')
    expect(code).toContain('from "/client-runtime.mjs"')

    const components = code.split('\n').map(line => line.trim()).filter(line => line.startsWith('const LazyHydration')).join('\n')
    expect(components).toContain(`const LazyHydrationVisibleMyComponent = createLazyVisibleComponent("components/MyComponent.vue"`)
    expect(components).toContain(`const LazyHydrationIdleMyComponent = createLazyIdleComponent("components/MyComponent.vue"`)
  })

  it('should handle parenthesized expressions', async () => {
    const sfc = `
    <script setup>
    const LazyHydrationVisibleMyComponent = defineLazyHydrationComponent('visible', () => (import('~/components/MyComponent.vue')))
    const LazyHydrationIdleMyComponent = defineLazyHydrationComponent('idle', () => {
      return (import('~/components/MyComponent.vue'))
    })
    </script>

    <template>
      <LazyHydrationVisibleMyComponent />
      <LazyHydrationIdleMyComponent />
    </template>
    `

    const code = await transform(sfc, '/pages/index.vue')
    expect(code).toContain('createLazyVisibleComponent')
    expect(code).toContain('createLazyIdleComponent')
    expect(code).toContain('from "/client-runtime.mjs"')

    const components = code.split('\n').map(line => line.trim()).filter(line => line.startsWith('const LazyHydration')).join('\n')
    expect(components).toContain(`const LazyHydrationVisibleMyComponent = createLazyVisibleComponent("components/MyComponent.vue"`)
    expect(components).toContain(`const LazyHydrationIdleMyComponent = createLazyIdleComponent("components/MyComponent.vue"`)
  })

  it('should handle member expressions and method chaining', async () => {
    const sfc = `
    <script setup>
    const LazyHydrationVisibleMyComponent = defineLazyHydrationComponent('visible', () => import('~/components/MyComponent.vue').then(m => m.default))
    const LazyHydrationIdleMyComponent = defineLazyHydrationComponent('idle', () => {
      return import('~/components/MyComponent.vue').then(m => m.default)
    })
    </script>

    <template>
      <LazyHydrationVisibleMyComponent />
      <LazyHydrationIdleMyComponent />
    </template>
    `

    const code = await transform(sfc, '/pages/index.vue')
    expect(code).toContain('createLazyVisibleComponent')
    expect(code).toContain('createLazyIdleComponent')
    expect(code).toContain('from "/client-runtime.mjs"')

    const components = code.split('\n').map(line => line.trim()).filter(line => line.startsWith('const LazyHydration')).join('\n')
    expect(components).toContain(`const LazyHydrationVisibleMyComponent = createLazyVisibleComponent("components/MyComponent.vue"`)
    expect(components).toContain(`const LazyHydrationIdleMyComponent = createLazyIdleComponent("components/MyComponent.vue"`)
  })

  it('should handle conditional expressions', async () => {
    const sfc = `
    <script setup>
    const LazyHydrationVisibleMyComponent = defineLazyHydrationComponent('visible', () => 
      process.env.NODE_ENV === 'development' 
        ? import('~/components/MyComponent.vue')
        : import('~/components/MyComponent.vue')
    )
    </script>

    <template>
      <LazyHydrationVisibleMyComponent />
    </template>
    `

    const code = await transform(sfc, '/pages/index.vue')
    expect(code).toContain(`import { createLazyVisibleComponent } from "/client-runtime.mjs";`)

    const component = code.split('\n').map(line => line.trim()).find(line => line.startsWith('const LazyHydration'))
    expect(component).toContain(`createLazyVisibleComponent("components/MyComponent.vue"`)
  })

  it('should handle complex nested patterns', async () => {
    const sfc = `
    <script setup>
    const LazyHydrationVisibleMyComponent = defineLazyHydrationComponent('visible', async () => {
      return await (import('~/components/MyComponent.vue')).then(m => m.default)
    })
    </script>

    <template>
      <LazyHydrationVisibleMyComponent />
    </template>
    `

    const code = await transform(sfc, '/pages/index.vue')
    expect(code).toContain(`import { createLazyVisibleComponent } from "/client-runtime.mjs";`)

    const components = code.split('\n').map(line => line.trim()).filter(line => line.startsWith('const LazyHydration')).join('\n')
    expect(components).toContain(`createLazyVisibleComponent("components/MyComponent.vue"`)
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
