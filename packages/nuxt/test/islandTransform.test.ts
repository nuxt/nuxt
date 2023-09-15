import { describe, expect, it, vi } from 'vitest'
import type { Plugin } from 'vite'
import type { Component } from '@nuxt/schema'
import type { UnpluginOptions } from 'unplugin'
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

const pluginViteDev = islandsTransform.raw({
  getComponents,
  rootDir: '/root',
  isDev: true
}, { framework: 'vite' }) as Plugin

const pluginWebpack = islandsTransform.raw({
  getComponents
}, { framework: 'webpack', webpack: { compiler: {} as any } })

const viteTransform = async (source: string, id: string, dev = false) => {
  const result = await ((dev ? pluginViteDev : pluginVite).transform! as Function)(source, id)
  return typeof result === 'string' ? result : result?.code
}

const webpackTransform = async (source: string, id: string) => {
  const result = await ((pluginWebpack as UnpluginOptions).transform! as Function)(source, id)
  return typeof result === 'string' ? result : result?.code
}

describe('islandTransform - server and island components', () => {
  describe('slots', () => {
    it('expect slot transform to match inline snapshot', async () => {
      const result = await viteTransform(`<template>
      <div>
        <slot />

        <slot name="named" :some-data="someData" />
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
              </div>
              </template>
              <script setup lang=\\"ts\\">
        import { vforToArray as __vforToArray } from '#app/components/utils'
        import NuxtTeleportSsrClient from '#app/components/nuxt-teleport-ssr-client'
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
        import NuxtTeleportSsrClient from '#app/components/nuxt-teleport-ssr-client'
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
        import NuxtTeleportSsrClient from '#app/components/nuxt-teleport-ssr-client'
            export interface Props {
              count?: number;
            }
            const props = withDefaults(defineProps<Props>(), { count: 0 });
            
            const message = \\"Hello World\\";
            </script>
            "
      `)
    })

    it('test transform with vite in dev', async () => {
      const result = await viteTransform(`<template>
      <div>
        <!-- should not be wrapped by NuxtTeleportSsrClient -->
        <HelloWorld />
        <!-- should be wrapped by NuxtTeleportSsrClient with a rootDir attr -->
        <HelloWorld nuxt-client />
      </div>
    </template>
    
    <script setup lang="ts">
    import HelloWorld from './HelloWorld.vue'
    </script>
    `, 'hello.server.vue', true)

      expect(normalizeLineEndings(result)).toMatchInlineSnapshot(`
        "<template>
              <div>
                <!-- should not be wrapped by NuxtTeleportSsrClient -->
                <HelloWorld />
                <!-- should be wrapped by NuxtTeleportSsrClient with a rootDir attr -->
                <NuxtTeleportSsrClient to=\\"HelloWorld-k4BKF0fec1\\" root-dir=\\"/root\\" :nuxt-client=\\"true\\"><HelloWorld /></NuxtTeleportSsrClient>
              </div>
            </template>
            
            <script setup lang=\\"ts\\">
        import { vforToArray as __vforToArray } from '#app/components/utils'
        import NuxtTeleportSsrClient from '#app/components/nuxt-teleport-ssr-client'
            import HelloWorld from './HelloWorld.vue'
            </script>
            "
      `)
    })

    it('test transform with webpack', async () => {
      const spyOnWarn = vi.spyOn(console, 'warn')
      const result = await webpackTransform(`<template>
      <div>
        <!-- should not be wrapped by NuxtTeleportSsrClient -->
        <HelloWorld />
    
        <!-- should be not wrapped by NuxtTeleportSsrClient for now -->
        <HelloWorld nuxt-client />
      </div>
    </template>
    
    <script setup lang="ts">
    import HelloWorld from './HelloWorld.vue'
    
    const someData = 'some data'
    </script>
    `, 'hello.server.vue')
      expect(normalizeLineEndings(result)).toMatchInlineSnapshot(`
        "<template>
              <div>
                <!-- should not be wrapped by NuxtTeleportSsrClient -->
                <HelloWorld />
            
                <!-- should be not wrapped by NuxtTeleportSsrClient for now -->
                <HelloWorld nuxt-client />
              </div>
            </template>
            
            <script setup lang=\\"ts\\">
        import { vforToArray as __vforToArray } from '#app/components/utils'
        import NuxtTeleportSsrClient from '#app/components/nuxt-teleport-ssr-client'
            import HelloWorld from './HelloWorld.vue'
            
            const someData = 'some data'
            </script>
            "
      `)

      expect(spyOnWarn).toHaveBeenCalledWith('nuxt-client attribute and client components within islands is only supported with Vite. file: hello.server.vue')
    })
  })
})
