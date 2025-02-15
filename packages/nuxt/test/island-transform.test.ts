import { describe, expect, it } from 'vitest'
import type { Plugin } from 'vite'
import type { Component } from '@nuxt/schema'
import { IslandsTransformPlugin } from '../src/components/plugins/islands-transform'
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
  preload: false,
}] as Component[]

const viteTransform = async (source: string, id: string, selectiveClient = false) => {
  const vitePlugin = IslandsTransformPlugin({
    getComponents,
    selectiveClient,
  }).raw({}, { framework: 'vite' }) as Plugin

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  const result = await (vitePlugin.transform! as Function)(source, id)
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

      </script>`,
      'hello.server.vue')

      expect(normalizeLineEndings(result)).toMatchInlineSnapshot(`
        "<template>
              <div>
                <NuxtTeleportSsrSlot name="default" :props="undefined"><slot /></NuxtTeleportSsrSlot>

                <NuxtTeleportSsrSlot name="named" :props="[{ [\`some-data\`]: someData }]"><slot name="named" :some-data="someData" /></NuxtTeleportSsrSlot>
                <NuxtTeleportSsrSlot name="other" :props="[{ [\`some-data\`]: someData }]"><slot
                  name="other"
                  :some-data="someData"
                /></NuxtTeleportSsrSlot>
              </div>
              </template>
              <script setup lang="ts">
        import { mergeProps as __mergeProps } from 'vue'
        import { vforToArray as __vforToArray } from '#app/components/utils'
        import NuxtTeleportIslandComponent from '#app/components/nuxt-teleport-island-component'
        import NuxtTeleportSsrSlot from '#app/components/nuxt-teleport-island-slot'
              const someData = 'some data'

              </script>"
      `)
    })

    it('generates bindings when props are needed to be merged', async () => {
      const result = await viteTransform(`<script setup lang="ts">
withDefaults(defineProps<{ things?: any[]; somethingElse?: string }>(), {
  things: () => [],
  somethingElse: "yay",
});
</script>

<template>
  <template v-for="thing in things">
    <slot name="thing" v-bind="thing" />
  </template>
</template>
`, 'hello.server.vue')

      expect(normalizeLineEndings(result)).toMatchInlineSnapshot(`
        "<script setup lang="ts">
        import { mergeProps as __mergeProps } from 'vue'
        import { vforToArray as __vforToArray } from '#app/components/utils'
        import NuxtTeleportIslandComponent from '#app/components/nuxt-teleport-island-component'
        import NuxtTeleportSsrSlot from '#app/components/nuxt-teleport-island-slot'
        withDefaults(defineProps<{ things?: any[]; somethingElse?: string }>(), {
          things: () => [],
          somethingElse: "yay",
        });
        </script>

        <template>
          <template v-for="thing in things">
            <NuxtTeleportSsrSlot name="thing" :props="[__mergeProps(thing, {  })]"><slot name="thing" v-bind="thing" /></NuxtTeleportSsrSlot>
          </template>
        </template>
        "
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

      </script>`,
      'hello.server.vue')

      expect(normalizeLineEndings(result)).toMatchInlineSnapshot(`
        "<template>
              <div>
                <NuxtTeleportSsrSlot name="default" :props="[{ [\`some-data\`]: someData }]"><slot :some-data="someData"/><template #fallback>
                  <div>fallback</div>
                </template></NuxtTeleportSsrSlot>
              </div>
              </template>
              <script setup lang="ts">
        import { mergeProps as __mergeProps } from 'vue'
        import { vforToArray as __vforToArray } from '#app/components/utils'
        import NuxtTeleportIslandComponent from '#app/components/nuxt-teleport-island-component'
        import NuxtTeleportSsrSlot from '#app/components/nuxt-teleport-island-slot'
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
    `,
      'hello.server.vue')

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
                      <NuxtTeleportSsrSlot name="default" :props="undefined"><slot/><template #fallback>
                        This is the default content of the slot, I should not see this after
                        the client loading has completed.
                      </template></NuxtTeleportSsrSlot>
                    </div>
                    <p>Above is the slot I want to be hydrated on the client</p>
                  </template>
                </UCard>
              </div>
            </template>

            <script setup lang="ts">
        import { mergeProps as __mergeProps } from 'vue'
        import { vforToArray as __vforToArray } from '#app/components/utils'
        import NuxtTeleportIslandComponent from '#app/components/nuxt-teleport-island-component'
        import NuxtTeleportSsrSlot from '#app/components/nuxt-teleport-island-slot'
            export interface Props {
              count?: number;
            }
            const props = withDefaults(defineProps<Props>(), { count: 0 });

            const message = "Hello World";
            </script>
            "
      `)
    })

    it('expect v-if/v-else/v-else-if to be set in teleport component wrapper', async () => {
      const result = await viteTransform(`<script setup lang="ts">
      const foo = true;
      </script>
      <template>
      <slot v-if="foo" />
      <slot v-else-if="test" />
      <slot v-else />
      </template>
      `, 'WithVif.vue', true)

      expect(normalizeLineEndings(result)).toMatchInlineSnapshot(`
        "<script setup lang="ts">
        import { mergeProps as __mergeProps } from 'vue'
        import { vforToArray as __vforToArray } from '#app/components/utils'
        import NuxtTeleportIslandComponent from '#app/components/nuxt-teleport-island-component'
        import NuxtTeleportSsrSlot from '#app/components/nuxt-teleport-island-slot'
              const foo = true;
              </script>
              <template>
              <NuxtTeleportSsrSlot v-if="foo" name="default" :props="undefined"><slot  /></NuxtTeleportSsrSlot>
              <NuxtTeleportSsrSlot v-else-if="test" name="default" :props="undefined"><slot  /></NuxtTeleportSsrSlot>
              <NuxtTeleportSsrSlot v-else name="default" :props="undefined"><slot  /></NuxtTeleportSsrSlot>
              </template>
              "
      `)
    })
  })
})
