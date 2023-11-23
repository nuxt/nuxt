import { describe, expect, it } from 'vitest'
import type { Plugin } from 'vite'
import type { Component } from '@nuxt/schema'
import { islandsTransform } from '../src/components/islandsTransform'
import { normalizeLineEndings } from './utils'

const getComponents = () => [{
  filePath: '/root/hello.server.vue',
  mode: 'server',
  pascalName: 'HelloWorld',
  island: true,
  kebabName: 'hello-world',
  chunkName: 'components/hello-world',
  export: 'default',
  shortPath: '',
  prefetch: false,
  preload: false
}] as Component[]

const pluginVite = islandsTransform.raw({
  getComponents
}, { framework: 'vite' }) as Plugin

const viteTransform = async (source: string, id: string) => {
  const result = await (pluginVite.transform! as Function)(source, id)
  return typeof result === 'string' ? result : result?.code
}

describe('islandTransform - server and island components', () => {
  describe('slots', () => {
    it('expect slot transform to match inline snapshot', async () => {
      const result = await viteTransform(`<template>
      <div>
        <slot />

        <slot name="named" :some-data="someData" />
        <slot
          name="other"
          :some-data="someData"
        />
      </div>
      </template>
      <script setup lang="ts">
      const someData = 'some data'

      </script>`
      , 'hello.server.vue')

      expect(normalizeLineEndings(result)).toMatchInlineSnapshot(`
        "<template>
              <div>
                <div style=\\"display: contents;\\" nuxt-ssr-slot-name=\\"default\\" />

                <div style=\\"display: contents;\\" nuxt-ssr-slot-name=\\"named\\" :nuxt-ssr-slot-data=\\"JSON.stringify([{ some-data: someData }])\\"/>
                <div style=\\"display: contents;\\" nuxt-ssr-slot-name=\\"other\\" :nuxt-ssr-slot-data=\\"JSON.stringify([{ some-data: someData }])\\"/>
              </div>
              </template>
              <script setup lang=\\"ts\\">
        import { vforToArray as __vforToArray } from '#app/components/utils'
              const someData = 'some data'

              </script>"
      `)
    })

    it('expect slot fallback transform to match inline snapshot', async () => {
      const result = await viteTransform(`<template>
      <div>
        <slot :some-data="someData">
          <div>fallback</div>
        </slot>
      </div>
      </template>
      <script setup lang="ts">
      const someData = 'some data'

      </script>`
      , 'hello.server.vue')

      expect(normalizeLineEndings(result)).toMatchInlineSnapshot(`
        "<template>
              <div>
                <div style=\\"display: contents;\\" nuxt-ssr-slot-name=\\"default\\" :nuxt-ssr-slot-data=\\"JSON.stringify([{ some-data: someData }])\\"><div nuxt-slot-fallback-start=\\"default\\"/><div  style=\\"display: contents;\\">
                  <div>fallback</div>
                </div><div nuxt-slot-fallback-end/></div>
              </div>
              </template>
              <script setup lang=\\"ts\\">
        import { vforToArray as __vforToArray } from '#app/components/utils'
              const someData = 'some data'

              </script>"
      `)
    })

    it('expect slot transform with fallback and no name to match inline snapshot #23209', async () => {
      const result = await viteTransform(`<template>
      <div>
        <UCard>
          <template #header>
            <h3>Partial Hydration Example - Server - {{ count }}</h3>
          </template>
          <template #default>
            <p>message: {{ message }}</p>
            <p>Below is the slot I want to be hydrated on the client</p>
            <div>
              <slot>
                This is the default content of the slot, I should not see this after
                the client loading has completed.
              </slot>
            </div>
            <p>Above is the slot I want to be hydrated on the client</p>
          </template>
        </UCard>
      </div>
    </template>

    <script setup lang="ts">
    export interface Props {
      count?: number;
    }
    const props = withDefaults(defineProps<Props>(), { count: 0 });

    const message = "Hello World";
    </script>
    `
      , 'hello.server.vue')

      expect(normalizeLineEndings(result)).toMatchInlineSnapshot(`
        "<template>
              <div>
                <UCard>
                  <template #header>
                    <h3>Partial Hydration Example - Server - {{ count }}</h3>
                  </template>
                  <template #default>
                    <p>message: {{ message }}</p>
                    <p>Below is the slot I want to be hydrated on the client</p>
                    <div>
                      <div style=\\"display: contents;\\" nuxt-ssr-slot-name=\\"default\\" ><div nuxt-slot-fallback-start=\\"default\\"/>
                        This is the default content of the slot, I should not see this after
                        the client loading has completed.
                      <div nuxt-slot-fallback-end/></div>
                    </div>
                    <p>Above is the slot I want to be hydrated on the client</p>
                  </template>
                </UCard>
              </div>
            </template>

            <script setup lang=\\"ts\\">
        import { vforToArray as __vforToArray } from '#app/components/utils'
            export interface Props {
              count?: number;
            }
            const props = withDefaults(defineProps<Props>(), { count: 0 });

            const message = \\"Hello World\\";
            </script>
            "
      `)
    })
  })
})
