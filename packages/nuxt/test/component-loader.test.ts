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

  it('should correctly resolve components with minifyWhitespace (esbuild) #32290', async () => {
    const content = `import { createHotContext as __vite__createHotContext } from "/_nuxt/@vite/client";import.meta.hot = __vite__createHotContext("/app.vue");import { recordPosition as _tracerRecordPosition } from "vite-plugin-vue-tracer/dist/client/record.mjs"
import{defineComponent as _defineComponent}from"vue";const _sfc_main=_defineComponent({__name:"app",setup(__props,{expose:__expose}){__expose();console.log("111");const __returned__={};Object.defineProperty(__returned__,"__isScriptSetup",{enumerable:false,value:true});return __returned__}});import{resolveComponent as _resolveComponent,createVNode as _createVNode,openBlock as _openBlock,createElementBlock as _createElementBlock}from"/_nuxt/node_modules/.pnpm/vue@3.5.16_typescript@5.8.3/node_modules/vue/dist/vue.runtime.esm-bundler.js?v=cbc061e8";function _sfc_render(_ctx,_cache,$props,$setup,$data,$options){const _component_NuxtRouteAnnouncer=_resolveComponent("MyComponent");const _component_NuxtWelcome=_resolveComponent("MyComponent");return _openBlock(),_tracer(2,2,_createElementBlock("div",null,[_tracer(3,4,_createVNode(_component_NuxtRouteAnnouncer)),_tracer(4,4,_createVNode(_component_NuxtWelcome))]))}_sfc_main.__hmrId="938b83b0";typeof __VUE_HMR_RUNTIME__!=="undefined"&&__VUE_HMR_RUNTIME__.createRecord(_sfc_main.__hmrId,_sfc_main);import.meta.hot.on("file-changed",({file})=>{__VUE_HMR_RUNTIME__.CHANGED_FILE=file});import.meta.hot.accept(mod=>{if(!mod)return;const{default:updated,_rerender_only}=mod;if(_rerender_only){__VUE_HMR_RUNTIME__.rerender(updated.__hmrId,updated.render)}else{__VUE_HMR_RUNTIME__.reload(updated.__hmrId,updated)}});import _export_sfc from"/_nuxt/@id/__x00__plugin-vue:export-helper";export default _export_sfc(_sfc_main,[["render",_sfc_render],["__file","/project/workspace/app.vue"]]);

function _tracer(line, column, vnode) { return _tracerRecordPosition("app.vue", line, column, vnode) }
`
    const code = await ((plugin.raw({}, { framework: 'vite' }) as { transform: (code: string, id: string) => { code: string } | null }).transform(
      content,
      '/app.vue',
    ))
    expect(code).toMatchInlineSnapshot(`
      {
        "code": "import { default as __nuxt_component_0 } from "/components/MyComponent.vue";
      import { createHotContext as __vite__createHotContext } from "/_nuxt/@vite/client";import.meta.hot = __vite__createHotContext("/app.vue");import { recordPosition as _tracerRecordPosition } from "vite-plugin-vue-tracer/dist/client/record.mjs"
      import{defineComponent as _defineComponent}from"vue";const _sfc_main=_defineComponent({__name:"app",setup(__props,{expose:__expose}){__expose();console.log("111");const __returned__={};Object.defineProperty(__returned__,"__isScriptSetup",{enumerable:false,value:true});return __returned__}});import{resolveComponent as _resolveComponent,createVNode as _createVNode,openBlock as _openBlock,createElementBlock as _createElementBlock}from"/_nuxt/node_modules/.pnpm/vue@3.5.16_typescript@5.8.3/node_modules/vue/dist/vue.runtime.esm-bundler.js?v=cbc061e8";function _sfc_render(_ctx,_cache,$props,$setup,$data,$options){const _component_NuxtRouteAnnouncer=__nuxt_component_0;const _component_NuxtWelcome=__nuxt_component_0;return _openBlock(),_tracer(2,2,_createElementBlock("div",null,[_tracer(3,4,_createVNode(_component_NuxtRouteAnnouncer)),_tracer(4,4,_createVNode(_component_NuxtWelcome))]))}_sfc_main.__hmrId="938b83b0";typeof __VUE_HMR_RUNTIME__!=="undefined"&&__VUE_HMR_RUNTIME__.createRecord(_sfc_main.__hmrId,_sfc_main);import.meta.hot.on("file-changed",({file})=>{__VUE_HMR_RUNTIME__.CHANGED_FILE=file});import.meta.hot.accept(mod=>{if(!mod)return;const{default:updated,_rerender_only}=mod;if(_rerender_only){__VUE_HMR_RUNTIME__.rerender(updated.__hmrId,updated.render)}else{__VUE_HMR_RUNTIME__.reload(updated.__hmrId,updated)}});import _export_sfc from"/_nuxt/@id/__x00__plugin-vue:export-helper";export default _export_sfc(_sfc_main,[["render",_sfc_render],["__file","/project/workspace/app.vue"]]);

      function _tracer(line, column, vnode) { return _tracerRecordPosition("app.vue", line, column, vnode) }
      ",
        "map": undefined,
      }
    `)

    expect(code?.code).toContain('__nuxt_component_0')
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
    ['hydrateOnIdle', 'createLazyIdleComponent'],
    ['hydrateOnVisible', 'createLazyVisibleComponent'],
    ['hydrateOnInteraction', 'createLazyInteractionComponent'],
    ['hydrateOnMediaQuery', 'createLazyMediaQueryComponent'],
    ['hydrateAfter', 'createLazyTimeComponent'],
    ['hydrateWhen', 'createLazyIfComponent'],
    ['hydrateNever', 'createLazyNeverComponent'],
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
const components = ([{ name: 'MyComponent', filePath: '/components/MyComponent.vue' }] as AddComponentOptions[]).map(opts => ({
  export: opts.export || 'default',
  chunkName: 'components/' + kebabCase(opts.name),
  global: opts.global ?? false,
  kebabName: kebabCase(opts.name || ''),
  pascalName: pascalCase(opts.name || ''),
  prefetch: false,
  preload: false,
  mode: 'all' as const,
  priority: 0,
  meta: {},
  ...opts,
}))

const plugin = LoaderPlugin({
  clientDelayedComponentRuntime: '/client-runtime.mjs',
  serverComponentRuntime: '/server-runtime.mjs',
  getComponents: () => components,
  srcDir: '/',
  mode: 'server',
})

async function transform (code: string, filename: string) {
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
      plugin.rollup(),
    ],
  })
  const { output: [chunk] } = await bundle.generate({})
  return chunk.code.trim()
}
