import { defu } from 'defu'
import { join } from 'pathe'
import { isTest } from 'std-env'
import type { Nuxt } from '../types/nuxt.ts'
import { defineResolvers } from '../utils/definition.ts'

export default defineResolvers({
  builder: {
    $resolve: (val) => {
      if (val && typeof val === 'object' && 'bundle' in val) {
        return val as { bundle: (nuxt: Nuxt) => Promise<void> }
      }
      const map = {
        rspack: '@nuxt/rspack-builder',
        vite: '@nuxt/vite-builder',
        webpack: '@nuxt/webpack-builder',
      }
      type Builder = 'vite' | 'webpack' | 'rspack'
      if (typeof val === 'string' && val in map) {
        // TODO: improve normalisation inference
        return map[val as keyof typeof map] as Builder
      }
      return map.vite as Builder
    },
  },
  sourcemap: {
    $resolve: async (val, get) => {
      if (typeof val === 'boolean') {
        return { server: val, client: val }
      }
      return {
        server: true,
        client: await get('dev'),
        ...typeof val === 'object' ? val : {},
      }
    },
  },
  logLevel: {
    $resolve: (val) => {
      if (val && typeof val === 'string' && !['silent', 'info', 'verbose'].includes(val)) {
        console.warn(`Invalid \`logLevel\` option: \`${val}\`. Must be one of: \`silent\`, \`info\`, \`verbose\`.`)
      }
      return val && typeof val === 'string' ? val as 'silent' | 'info' | 'verbose' : (isTest ? 'silent' : 'info')
    },
  },
  build: {
    transpile: {
      $resolve: (val) => {
        const transpile: Array<string | RegExp | ((ctx: { isClient?: boolean, isServer?: boolean, isDev: boolean }) => string | RegExp | false)> = []
        if (Array.isArray(val)) {
          for (const pattern of val) {
            if (!pattern) {
              continue
            }
            if (typeof pattern === 'string' || typeof pattern === 'function' || pattern instanceof RegExp) {
              transpile.push(pattern)
            }
          }
        }
        return transpile
      },
    },
    templates: [],
    analyze: {
      $resolve: async (val, get) => {
        const [rootDir, analyzeDir] = await Promise.all([get('rootDir'), get('analyzeDir')])
        return {
          template: 'treemap',
          projectRoot: rootDir,
          filename: join(analyzeDir, '{name}.html'),
          ...typeof val === 'boolean' ? { enabled: val } : typeof val === 'object' ? val : {},
        }
      },
    },
  },
  optimization: {
    keyedComposables: {
      $resolve: val => [
        { name: 'callOnce', argumentLength: 3 },
        { name: 'defineNuxtComponent', argumentLength: 2 },
        { name: 'useState', argumentLength: 2 },
        { name: 'useFetch', argumentLength: 3 },
        { name: 'useAsyncData', argumentLength: 3 },
        { name: 'useLazyAsyncData', argumentLength: 3 },
        { name: 'useLazyFetch', argumentLength: 3 },
        ...Array.isArray(val) ? val : [],
      ].filter(Boolean),
    },
    treeShake: {
      composables: {
        server: {
          $resolve: async (val, get) => defu(typeof val === 'object' ? val as Record<string, string[]> || {} : {},
            await get('dev')
              ? {}
              : {
                  'vue': ['onMounted', 'onUpdated', 'onUnmounted', 'onBeforeMount', 'onBeforeUpdate', 'onBeforeUnmount', 'onRenderTracked', 'onRenderTriggered', 'onActivated', 'onDeactivated'],
                  '#app': ['definePayloadReviver', 'definePageMeta'],
                },
          ),
        },
        client: {
          $resolve: async (val, get) => defu(typeof val === 'object' ? val as Record<string, string[]> || {} : {},
            await get('dev')
              ? {}
              : {
                  'vue': ['onRenderTracked', 'onRenderTriggered', 'onServerPrefetch'],
                  '#app': ['definePayloadReducer', 'definePageMeta', 'onPrehydrate'],
                },
          ),
        },
      },
    },
    asyncTransforms: {
      asyncFunctions: ['defineNuxtPlugin', 'defineNuxtRouteMiddleware'],
      objectDefinitions: {
        defineNuxtComponent: ['asyncData', 'setup'],
        defineNuxtPlugin: ['setup'],
        definePageMeta: ['middleware', 'validate'],
      },
    },
  },
})
