import { describe, expectTypeOf, it } from 'vitest'

import type { ComponentsOptions, NuxtBuilder, NuxtConfig, NuxtDebugOptions, NuxtModule, NuxtOptions, TracingChannelOptions, ViewTransitionOptions } from '../src/index.ts'

describe('nuxt.config input', () => {
  it('accepts shorthand values', () => {
    expectTypeOf<{ components: false }>().toExtend<NuxtConfig>()
    expectTypeOf<{ components: { global: true } }>().toExtend<NuxtConfig>()
    expectTypeOf<{ components: ['~/widgets'] }>().toExtend<NuxtConfig>()
    expectTypeOf<{ sourcemap: true }>().toExtend<NuxtConfig>()
    expectTypeOf<{ debug: true }>().toExtend<NuxtConfig>()
    expectTypeOf<{ builder: 'webpack' }>().toExtend<NuxtConfig>()
    expectTypeOf<{ modules: [false, null, undefined] }>().toExtend<NuxtConfig>()
    expectTypeOf<{ app: { viewTransition: true } }>().toExtend<NuxtConfig>()
    expectTypeOf<{ build: { analyze: true } }>().toExtend<NuxtConfig>()
    expectTypeOf<{ postcss: { order: 'cssnanoLast' } }>().toExtend<NuxtConfig>()
    expectTypeOf<{ features: { noScripts: true } }>().toExtend<NuxtConfig>()
    expectTypeOf<{ experimental: { componentIslands: 'local+remote', ssrStreaming: true } }>().toExtend<NuxtConfig>()
    expectTypeOf<{ tracingChannel: true }>().toExtend<NuxtConfig>()
    expectTypeOf<{ nitroLegacy: true }>().toExtend<NuxtConfig>()
    expectTypeOf<{ nitroLegacy: { h3: false } }>().toExtend<NuxtConfig>()
  })
})

describe('resolved options', () => {
  it('have the canonical shape', () => {
    expectTypeOf<NuxtOptions['components']>().toEqualTypeOf<ComponentsOptions>()
    expectTypeOf<NuxtOptions['sourcemap']>().toEqualTypeOf<{ server: boolean | 'hidden' | 'nosource', client: boolean | 'hidden' | 'nosource' }>()
    expectTypeOf<NuxtOptions['debug']>().toEqualTypeOf<NuxtDebugOptions | false>()
    expectTypeOf<NuxtOptions['builder']>().toEqualTypeOf<'@nuxt/vite-builder' | '@nuxt/webpack-builder' | '@nuxt/rsbuild-builder' | '@nuxt/rspack-builder' | NuxtBuilder>()
    expectTypeOf<NuxtOptions['modules']>().toEqualTypeOf<Array<NuxtModule<any> | string | [NuxtModule | string, Record<string, any>]>>()
    expectTypeOf<NuxtOptions['spaLoadingTemplate']>().toEqualTypeOf<string | boolean | null>()
    expectTypeOf<NuxtOptions['app']['viewTransition']>().toEqualTypeOf<ViewTransitionOptions>()
    expectTypeOf<NuxtOptions['postcss']['order']>().toEqualTypeOf<string[] | ((names: string[]) => string[])>()
    expectTypeOf<NuxtOptions['future']['compatibilityVersion']>().toEqualTypeOf<5>()
    expectTypeOf<NuxtOptions['features']['noScripts']>().toEqualTypeOf<false | 'production' | 'all'>()
    expectTypeOf<NuxtOptions['experimental']['payloadExtraction']>().toEqualTypeOf<boolean | 'client'>()
    expectTypeOf<NuxtOptions['experimental']['ssrStreaming']>().toEqualTypeOf<{ enabled: boolean, botRegex: RegExp }>()
    expectTypeOf<NuxtOptions['tracingChannel']>().toEqualTypeOf<false | TracingChannelOptions>()
    expectTypeOf<NuxtOptions['routeRules']>().not.toBeNullable()
  })

  it('keep the properties that resolve to the same type', () => {
    expectTypeOf<NuxtOptions['rootDir']>().toEqualTypeOf<string>()
    expectTypeOf<NuxtOptions['experimental']['typedPages']>().toEqualTypeOf<boolean>()
    expectTypeOf<NuxtOptions['app']['baseURL']>().toEqualTypeOf<string>()
  })

  it('narrow the shorthand of nested options', () => {
    expectTypeOf<'local'>().not.toExtend<NuxtOptions['experimental']['componentIslands']>()
    expectTypeOf<true>().not.toExtend<NuxtOptions['build']['analyze']>()
    expectTypeOf<true>().not.toExtend<NuxtOptions['webpack']['analyze']>()
  })

  it('keep the per-environment webpack config', () => {
    expectTypeOf<NuxtOptions['webpack']>().toHaveProperty('$client')
    expectTypeOf<NuxtOptions['webpack']>().toHaveProperty('$server')
  })
})
