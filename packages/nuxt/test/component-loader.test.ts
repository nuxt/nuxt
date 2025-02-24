import { describe, expect, it } from 'vitest'
import { kebabCase, pascalCase } from 'scule'
import { rollup } from 'rollup'
import type { Plugin } from 'rollup'
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
    </template>
    `
    const code = await transform(sfc, '/pages/index.vue')
    expect(code).toMatchInlineSnapshot(`
      "import { createLazyIdleComponent, createLazyVisibleComponent, createLazyInteractionComponent, createLazyMediaQueryComponent, createLazyTimeComponent, createLazyIfComponent } from '../client-runtime.mjs';
      import { createElementBlock, openBlock, Fragment, createVNode, withCtx } from 'vue';

      var _export_sfc = (sfc, props) => {
        const target = sfc.__vccOpts || sfc;
        for (const [key, val] of props) {
          target[key] = val;
        }
        return target;
      };

      const __nuxt_component_0_lazy_idle = createLazyIdleComponent(() => import('../components/MyComponent.vue').then(c => c.default || c));
      const __nuxt_component_0_lazy_visible = createLazyVisibleComponent(() => import('../components/MyComponent.vue').then(c => c.default || c));
      const __nuxt_component_0_lazy_event = createLazyInteractionComponent(() => import('../components/MyComponent.vue').then(c => c.default || c));
      const __nuxt_component_0_lazy_media = createLazyMediaQueryComponent(() => import('../components/MyComponent.vue').then(c => c.default || c));
      const __nuxt_component_0_lazy_time = createLazyTimeComponent(() => import('../components/MyComponent.vue').then(c => c.default || c));
      const __nuxt_component_0_lazy_if = createLazyIfComponent(() => import('../components/MyComponent.vue').then(c => c.default || c));
      const _sfc_main = {};

      function _sfc_render(_ctx, _cache) {
        const _component_LazyIdleMyComponent = __nuxt_component_0_lazy_idle;
        const _component_LazyVisibleMyComponent = __nuxt_component_0_lazy_visible;
        const _component_LazyInteractionMyComponent = __nuxt_component_0_lazy_event;
        const _component_LazyMediaQueryMyComponent = __nuxt_component_0_lazy_media;
        const _component_LazyTimeMyComponent = __nuxt_component_0_lazy_time;
        const _component_LazyIfMyComponent = __nuxt_component_0_lazy_if;

        return (openBlock(), createElementBlock(Fragment, null, [
          createVNode(_component_LazyIdleMyComponent, { "hydrate-on-idle": 3000 }),
          createVNode(_component_LazyVisibleMyComponent, { "hydrate-on-visible": {threshold: 0.2} }),
          createVNode(_component_LazyInteractionMyComponent, { "hydrate-on-interaction": ['click','mouseover'] }),
          createVNode(_component_LazyMediaQueryMyComponent, { "hydrate-on-media-query": "(max-width: 500px)" }),
          createVNode(_component_LazyTimeMyComponent, { "hydrate-after": 3000 }),
          createVNode(_component_LazyTimeMyComponent, { hydrateAfter: 3000 }),
          createVNode(_component_LazyIdleMyComponent, { "hydrate-on-idle": _ctx.hydrateOnIdle }, {
            default: withCtx(() => [
              createVNode(_component_LazyIfMyComponent, { "hydrate-when": "true" })
            ]),
            _: 1 /* STABLE */
          }, 8 /* PROPS */, ["hydrate-on-idle"]),
          createVNode(_component_LazyVisibleMyComponent, { "hydrate-on-visible": "" })
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
  const [pre, post] = LoaderPlugin({
    clientDelayedComponentRuntime: '/client-runtime.mjs',
    serverComponentRuntime: '/server-runtime.mjs',
    getComponents: () => components,
    lazyHydration: true,
    mode: 'server',
  }).rollup() as Plugin[]
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
      pre,
      vuePlugin(),
      vuePluginJsx(),
      post,
    ],
  })
  const { output: [chunk] } = await bundle.generate({})
  return chunk.code.trim()
}
