import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Component, Nuxt } from '@nuxt/schema'
import { kebabCase } from 'scule'

import { createTransformPlugin } from '../src/components/transform'

describe('components:transform', () => {
  it('should transform #components imports', async () => {
    const transform = createTransformer([
      createComponent('Foo'),
      createComponent('Bar', { export: 'Bar' })
    ])

    const code = await transform('import { Foo, Bar } from \'#components\'', '/app.vue')
    expect(code).toMatchInlineSnapshot(`
      "import Foo from '/Foo.vue';
      import { Bar } from '/Bar.vue';
      "
    `)
  })

  it('should correctly resolve server-only components', async () => {
    const transform = createTransformer([
      createComponent('Foo', { mode: 'server' })
    ])

    const code = await transform('import { Foo, LazyFoo } from \'#components\'', '/app.vue')
    expect(code).toMatchInlineSnapshot(`
      "import Foo from '/Foo.vue?nuxt_component=server&nuxt_component_name=Foo&nuxt_component_export=default';
      import LazyFoo from '/Foo.vue?nuxt_component=server,async&nuxt_component_name=Foo&nuxt_component_export=default';
      "
    `)

    expect(await transform('', '/Foo.vue?nuxt_component=server&nuxt_component_name=Foo&nuxt_component_export=default')).toMatchInlineSnapshot(`
      "import { createServerComponent } from "<repo>/nuxt/src/components/runtime/server-component"
      export default createServerComponent("Foo")"
    `)
    expect(await transform('', '/Foo.vue?nuxt_component=server,async&nuxt_component_name=Foo&nuxt_component_export=default')).toMatchInlineSnapshot(`
      "import { createServerComponent } from "<repo>/nuxt/src/components/runtime/server-component"
      export default createServerComponent("Foo")"
    `)
    expect(await transform('', '/Foo.vue?nuxt_component=server&nuxt_component_name=Foo&nuxt_component_export=Foo')).toMatchInlineSnapshot(`
      "import { createServerComponent } from "<repo>/nuxt/src/components/runtime/server-component"
      export const Foo = createServerComponent("Foo")"
    `)
  })

  it('should correctly resolve client-only components', async () => {
    const transform = createTransformer([
      createComponent('Foo', { mode: 'client' })
    ])

    const code = await transform('import { Foo, LazyFoo } from \'#components\'', '/app.vue')
    expect(code).toMatchInlineSnapshot(`
      "import Foo from '/Foo.vue?nuxt_component=client&nuxt_component_name=Foo&nuxt_component_export=default';
      import LazyFoo from '/Foo.vue?nuxt_component=client,async&nuxt_component_name=Foo&nuxt_component_export=default';
      "
    `)

    expect(await transform('', '/Foo.vue?nuxt_component=client&nuxt_component_name=Foo&nuxt_component_export=default')).toMatchInlineSnapshot(`
      "import { default as __component } from "/Foo.vue";
      import { createClientOnly } from "#app/components/client-only"
      export default createClientOnly(__component)"
    `)
    expect(await transform('', '/Foo.vue?nuxt_component=client,async&nuxt_component_name=Foo&nuxt_component_export=default')).toMatchInlineSnapshot(`
      "import { defineAsyncComponent } from "vue"
      import { createClientOnly } from "#app/components/client-only"
      export default defineAsyncComponent(() => import("/Foo.vue").then(r => createClientOnly(r["default"] || r.default || r)))"
    `)
    expect(await transform('', '/Foo.vue?nuxt_component=client,async&nuxt_component_name=Foo&nuxt_component_export=Foo')).toMatchInlineSnapshot(`
      "import { defineAsyncComponent } from "vue"
      import { createClientOnly } from "#app/components/client-only"
      export const Foo = defineAsyncComponent(() => import("/Foo.vue").then(r => createClientOnly(r["Foo"] || r.default || r)))"
    `)
  })
})

const rootDir = fileURLToPath(new URL('../..', import.meta.url))

function createTransformer (components: Component[], mode: 'client' | 'server' | 'all' = 'all') {
  const stubNuxt = {
    options: {
      buildDir: '/',
      sourcemap: {
        server: false,
        client: false
      }
    }
  } as Nuxt
  const plugin = createTransformPlugin(stubNuxt, () => components, mode).vite()

  return async (code: string, id: string) => {
    const result = await (plugin as any).transform!(code, id)
    return (typeof result === 'string' ? result : result?.code)?.replaceAll(rootDir, '<repo>/')
  }
}

function createComponent (pascalName: string, options: Partial<Component> = {}) {
  return {
    filePath: `/${pascalName}.vue`,
    pascalName,
    export: 'default',
    chunkName: `components/${pascalName.toLowerCase()}`,
    kebabName: kebabCase(pascalName),
    mode: 'all',
    prefetch: false,
    preload: false,
    shortPath: `components/${pascalName}.vue`,
    ...options
  } satisfies Component
}
