import { describe, expect, it } from 'vitest'
import { kebabCase, pascalCase } from 'scule'
import { rollup } from 'rollup'
import vuePlugin from '@vitejs/plugin-vue'
import vuePluginJsx from '@vitejs/plugin-vue-jsx'
import type { AddComponentOptions } from '@nuxt/kit'

import { LoaderPlugin } from '../src/components/plugins/loader'
import { LazyHydrationTransformPlugin } from '../src/components/plugins/lazy-hydration-transform'

describe('components:loader', () => {
  it('should correctly resolve components', async () => {
    const sfc = `
    <template>
      <MyComponent />
      <LazyMyComponent />
      <RouterLink />
      <NamedComponent />
    </template>

    <script setup>
    const NamedComponent = resolveComponent('MyComponent')
    </script>
    `
    const code = await transform(sfc, '/pages/index.vue')
    expect(code).toMatchInlineSnapshot(`
      "import __nuxt_component_0 from '../components/MyComponent.vue';
      import { defineAsyncComponent, resolveComponent, createElementBlock, openBlock, Fragment, createVNode, unref } from 'vue';

      const __nuxt_component_0_lazy = defineAsyncComponent(() => import('../components/MyComponent.vue').then(c => c.default || c));


      const _sfc_main = {
        __name: 'index',
        setup(__props) {

          const NamedComponent = __nuxt_component_0;
          
      return (_ctx, _cache) => {
        const _component_MyComponent = __nuxt_component_0;
        const _component_LazyMyComponent = __nuxt_component_0_lazy;
        const _component_RouterLink = resolveComponent("RouterLink");

        return (openBlock(), createElementBlock(Fragment, null, [
          createVNode(_component_MyComponent),
          createVNode(_component_LazyMyComponent),
          createVNode(_component_RouterLink),
          createVNode(unref(NamedComponent))
        ], 64 /* STABLE_FRAGMENT */))
      }
      }

      };

      export { _sfc_main as default };"
    `)
  })

  it('should work in jsx', async () => {
    const component = `
    import { defineComponent } from 'vue'
    export default defineComponent({
      setup () {
        const NamedComponent = resolveComponent('MyComponent')
        return () => <div>
          <MyComponent />
          <LazyMyComponent />
          <RouterLink />
          <NamedComponent />
        </div>
      }
    })
    `
    const code = await transform(component, '/pages/about.tsx')
    expect(code).toMatchInlineSnapshot(`
      "import __nuxt_component_0 from '../components/MyComponent.vue';
      import { defineAsyncComponent, defineComponent, createVNode, resolveComponent } from 'vue';

      const __nuxt_component_0_lazy = defineAsyncComponent(() => import('../components/MyComponent.vue').then(c => c.default || c));
      var about = /* @__PURE__ */ defineComponent({
        setup() {
          const NamedComponent = __nuxt_component_0;
          return () => createVNode("div", null, [createVNode(__nuxt_component_0, null, null), createVNode(__nuxt_component_0_lazy, null, null), createVNode(resolveComponent("RouterLink"), null, null), createVNode(NamedComponent, null, null)]);
        }
      });

      export { about as default };"
    `)
  })

  it('should correctly resolve lazy hydration components', async () => {
    const sfc = `
    <template>
      <LazyMyComponent :hydrate-on-idle="3000" />
      <LazyMyComponent :hydrate-on-visible="{threshold: 0.2}" />
      <LazyMyComponent :hydrate-on-interaction="['click','mouseover']" />
      <LazyMyComponent hydrate-on-media-query="(max-width: 500px)" />
      <LazyMyComponent :hydrate-after="3000" />
      <LazyMyComponent :hydrateAfter="3000" />
      <LazyMyComponent :hydrate-on-idle>
        <LazyMyComponent hydrate-when="true" />
      </LazyMyComponent>
      <LazyMyComponent hydrate-on-visible />
      <LazyMyComponent hydrate-never />
    </template>
    `
    const lines = await transform(sfc, '/pages/index.vue').then(r => r.split('\n'))
    const imports = lines.filter(l => l.startsWith('import'))
    expect(imports.join('\n')).toMatchInlineSnapshot(`
      "import { createLazyIdleComponent, createLazyVisibleComponent, createLazyInteractionComponent, createLazyMediaQueryComponent, createLazyTimeComponent, createLazyIfComponent, createLazyNeverComponent } from '../client-runtime.mjs';
      import { createElementBlock, openBlock, Fragment, createVNode, withCtx } from 'vue';"
    `)
    const components = lines.filter(l => l.startsWith('const __nuxt_component'))
    expect(components.join('\n')).toMatchInlineSnapshot(`
      "const __nuxt_component_0_lazy_idle = createLazyIdleComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const __nuxt_component_0_lazy_visible = createLazyVisibleComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const __nuxt_component_0_lazy_event = createLazyInteractionComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const __nuxt_component_0_lazy_media = createLazyMediaQueryComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const __nuxt_component_0_lazy_time = createLazyTimeComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const __nuxt_component_0_lazy_if = createLazyIfComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));
      const __nuxt_component_0_lazy_never = createLazyNeverComponent("components/MyComponent.vue", () => import('../components/MyComponent.vue').then(c => c.default || c));"
    `)
  })

  it.each([
    ['hydrate-on-idle', 'createLazyIdleComponent'],
    ['hydrate-on-visible', 'createLazyVisibleComponent'],
    ['hydrate-on-interaction', 'createLazyInteractionComponent'],
    ['hydrate-on-media-query', 'createLazyMediaQueryComponent'],
    ['hydrate-after', 'createLazyTimeComponent'],
    ['hydrate-when', 'createLazyIfComponent'],
    ['hydrate-never', 'createLazyNeverComponent'],
  ])('should correctly resolve lazy hydration components %s', async (prop, component) => {
    const sfc = `
    <template>
      <LazyMyComponent ${prop} />
    </template>
    `
    const result = await transform(sfc, '/pages/index.vue').then(r => r.split('\n'))
    expect(result.join('\n')).toContain(component)
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
      vuePlugin() as any,
      vuePluginJsx(),
      LoaderPlugin({
        clientDelayedComponentRuntime: '/client-runtime.mjs',
        serverComponentRuntime: '/server-runtime.mjs',
        getComponents: () => components,
        srcDir: '/',
        mode: 'server',
      }).rollup(),
    ],
  })
  const { output: [chunk] } = await bundle.generate({})
  return chunk.code.trim()
}
