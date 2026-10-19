import { describe, expect, it } from 'vitest'
import { compileTemplate } from 'vue/compiler-sfc'
import { RenderListPlugin } from '../src/components/plugins/render-list.ts'

const plugin = RenderListPlugin().raw({}, { framework: 'rollup', versions: {} }) as {
  transform: {
    filter: { id: { include: RegExp[] }, code: { include: RegExp } }
    handler: (code: string, id: string) => { code: string } | undefined
  }
}

const { filter } = plugin.transform

function transform (code: string, id = 'Component.vue') {
  if (!filter.id.include.some(re => re.test(id)) || !filter.code.include.test(code)) {
    return
  }
  const result = plugin.transform.handler(code, id)
  return result && (typeof result === 'string' ? result : result.code.toString())
}

function compile (source: string) {
  return compileTemplate({ source, filename: 'Component.vue', id: 'test', ssr: true }).code
}

describe('render-list plugin', () => {
  it('rewrites the ssrRenderList import in compiled SSR output', () => {
    const code = compile('<div><span v-for="n in count" :key="n">{{ n }}</span></div>')
    expect(transform(code)).toMatchInlineSnapshot(`
      "import { ssrRenderAttrs as _ssrRenderAttrs, ssrInterpolate as _ssrInterpolate } from "vue/server-renderer"
      import { ssrRenderList as _ssrRenderList } from "#app/components/render-list";

      export function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${_ssrRenderAttrs(_attrs)}><!--[-->\`)
        _ssrRenderList(_ctx.count, (n) => {
          _push(\`<span>\${_ssrInterpolate(n)}</span>\`)
        })
        _push(\`<!--]--></div>\`)
      }"
    `)
  })

  it('rewrites the renderList import used by slot content in compiled SSR output', () => {
    const code = compile('<Wrapper><span v-for="n in count" :key="n" /></Wrapper>')
    expect(transform(code)).toMatchInlineSnapshot(`
      "import { resolveComponent as _resolveComponent, withCtx as _withCtx, Fragment as _Fragment, openBlock as _openBlock, createBlock as _createBlock } from "vue"
      import { renderList as _renderList } from "#app/components/render-list";
      import { ssrRenderComponent as _ssrRenderComponent } from "vue/server-renderer"
      import { ssrRenderList as _ssrRenderList } from "#app/components/render-list";

      export function ssrRender(_ctx, _push, _parent, _attrs) {
        const _component_Wrapper = _resolveComponent("Wrapper")

        _push(_ssrRenderComponent(_component_Wrapper, _attrs, {
          default: _withCtx((_, _push, _parent, _scopeId) => {
            if (_push) {
              _push(\`<!--[-->\`)
              _ssrRenderList(_ctx.count, (n) => {
                _push(\`<span\${_scopeId}></span>\`)
              })
              _push(\`<!--]-->\`)
            } else {
              return [
                (_openBlock(true), _createBlock(_Fragment, null, _renderList(_ctx.count, (n) => {
                  return (_openBlock(), _createBlock("span", { key: n }))
                }), 128 /* KEYED_FRAGMENT */))
              ]
            }
          }),
          _: 1 /* STABLE */
        }, _parent))
      }"
    `)
  })

  it('replaces an import that only contains the helper', () => {
    expect(transform(`import { ssrRenderList as _ssrRenderList } from 'vue/server-renderer'\n_ssrRenderList(1, () => {})`))
      .toMatchInlineSnapshot(`
        "import { ssrRenderList as _ssrRenderList } from "#app/components/render-list";
        _ssrRenderList(1, () => {})"
      `)
  })

  it('keeps the other specifiers of the import', () => {
    expect(transform(`import { ssrRenderList as _a, ssrInterpolate as _b } from 'vue/server-renderer'`))
      .toMatchInlineSnapshot(`
        "import { ssrInterpolate as _b } from 'vue/server-renderer'
        import { ssrRenderList as _a } from "#app/components/render-list";"
      `)
    expect(transform(`import { ssrInterpolate as _b, ssrRenderList, ssrRenderAttrs } from 'vue/server-renderer'`))
      .toMatchInlineSnapshot(`
        "import { ssrInterpolate as _b, ssrRenderAttrs } from 'vue/server-renderer'
        import { ssrRenderList } from "#app/components/render-list";"
      `)
    expect(transform(`import Vue, { h, renderList } from 'vue'`))
      .toMatchInlineSnapshot(`
        "import Vue, { h } from 'vue'
        import { renderList } from "#app/components/render-list";"
      `)
  })

  it('leaves helpers from other sources untouched', () => {
    expect(transform(`import { ssrRenderList, renderList } from './local'\nssrRenderList(1, () => {})`)).toBeUndefined()
    expect(transform(`import { renderList } from 'vue/server-renderer'`)).toBeUndefined()
    expect(transform(`import type { renderList } from 'vue'`)).toBeUndefined()
  })

  it('only includes compiled Vue modules', () => {
    const matches = (id: string) => filter.id.include.some(re => re.test(id))
    expect(matches('/app/Component.vue')).toBe(true)
    expect(matches('/app/Component.vue?vue&type=template&lang.js')).toBe(true)
    expect(matches('/app/Component.vue?vue&type=template&id=abc&ts=true')).toBe(true)
    expect(matches('/app/template.html?vue&type=template&src=true&lang.js')).toBe(true)
    expect(matches('/app/template.html?vue&type=template&id=abc&external')).toBe(true)
    expect(matches('/app/utils.ts')).toBe(false)
    expect(matches('/node_modules/vue/server-renderer/index.mjs')).toBe(false)
  })
})
