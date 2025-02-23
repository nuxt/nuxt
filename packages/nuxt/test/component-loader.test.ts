import { describe, expect, it } from 'vitest'
import { kebabCase, pascalCase } from 'scule'
import { rollup } from 'rollup'
import vuePlugin from '@vitejs/plugin-vue'
import vuePluginJsx from '@vitejs/plugin-vue-jsx'
import type { AddComponentOptions } from '@nuxt/kit'

import { LoaderPlugin } from '../src/components/plugins/loader'

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

  it('should correctly resolve deferred hydration components', async () => {
    const sfc = `
    <template>
      <LazyIdleMyComponent :hydrate="3000" />
      <LazyVisibleMyComponent :hydrate="{threshold: 0.2}" />
      <LazyEventMyComponent :hydrate="['click','mouseover']" />
      <LazyMediaMyComponent hydrate="(max-width: 500px)" />
      <LazyIfMyComponent :hydrate="someCondition" />
      <LazyTimeMyComponent :hydrate="3000" />
      <LazyPromiseMyComponent :hydrate="promise" />
    </template>
    `
    const code = await transform(sfc, '/pages/index.vue')
    expect(code).toMatchInlineSnapshot(`
      "import { createLazyIdleComponent, createLazyVisibleComponent, createLazyEventComponent, createLazyMediaComponent, createLazyIfComponent, createLazyTimeComponent, createLazyPromiseComponent } from '../client-runtime.mjs';
      import { createElementBlock, openBlock, Fragment, createVNode } from 'vue';

      var _export_sfc = (sfc, props) => {
        const target = sfc.__vccOpts || sfc;
        for (const [key, val] of props) {
          target[key] = val;
        }
        return target;
      };

      const __nuxt_component_0_delayedNetwork = createLazyIdleComponent(() => import('../components/MyComponent.vue').then(c => c.default || c));
      const __nuxt_component_0_delayedIO = createLazyVisibleComponent(() => import('../components/MyComponent.vue').then(c => c.default || c));
      const __nuxt_component_0_delayedEvent = createLazyEventComponent(() => import('../components/MyComponent.vue').then(c => c.default || c));
      const __nuxt_component_0_delayedMedia = createLazyMediaComponent(() => import('../components/MyComponent.vue').then(c => c.default || c));
      const __nuxt_component_0_delayedIf = createLazyIfComponent(() => import('../components/MyComponent.vue').then(c => c.default || c));
      const __nuxt_component_0_delayedTime = createLazyTimeComponent(() => import('../components/MyComponent.vue').then(c => c.default || c));
      const __nuxt_component_0_delayedPromise = createLazyPromiseComponent(() => import('../components/MyComponent.vue').then(c => c.default || c));
      const _sfc_main = {};

      function _sfc_render(_ctx, _cache) {
        const _component_LazyIdleMyComponent = __nuxt_component_0_delayedNetwork;
        const _component_LazyVisibleMyComponent = __nuxt_component_0_delayedIO;
        const _component_LazyEventMyComponent = __nuxt_component_0_delayedEvent;
        const _component_LazyMediaMyComponent = __nuxt_component_0_delayedMedia;
        const _component_LazyIfMyComponent = __nuxt_component_0_delayedIf;
        const _component_LazyTimeMyComponent = __nuxt_component_0_delayedTime;
        const _component_LazyPromiseMyComponent = __nuxt_component_0_delayedPromise;

        return (openBlock(), createElementBlock(Fragment, null, [
          createVNode(_component_LazyIdleMyComponent, { hydrate: 3000 }),
          createVNode(_component_LazyVisibleMyComponent, { hydrate: {threshold: 0.2} }),
          createVNode(_component_LazyEventMyComponent, { hydrate: ['click','mouseover'] }),
          createVNode(_component_LazyMediaMyComponent, { hydrate: "(max-width: 500px)" }),
          createVNode(_component_LazyIfMyComponent, { hydrate: _ctx.someCondition }, null, 8 /* PROPS */, ["hydrate"]),
          createVNode(_component_LazyTimeMyComponent, { hydrate: 3000 }),
          createVNode(_component_LazyPromiseMyComponent, { hydrate: _ctx.promise }, null, 8 /* PROPS */, ["hydrate"])
        ], 64 /* STABLE_FRAGMENT */))
      }
      var index = /*#__PURE__*/_export_sfc(_sfc_main, [['render',_sfc_render]]);

      export { index as default };"
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
      vuePlugin(),
      vuePluginJsx(),
      LoaderPlugin({
        clientDelayedComponentRuntime: '/client-runtime.mjs',
        serverComponentRuntime: '/server-runtime.mjs',
        getComponents: () => components,
        mode: 'server',
      }).rollup(),
    ],
  })
  const { output: [chunk] } = await bundle.generate({})
  return chunk.code.trim()
}
