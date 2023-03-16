/**
 * Extends interfaces in Vue.js
 */

import type Vue from 'vue'
import type { MetaInfo } from 'vue-meta'
import type { Route } from 'vue-router'
import type { RecordPropsDefinition, ComponentOptions } from 'vue/types/options'
import type { ComponentOptionsMixin } from 'vue/types/v3-component-options'
import type { CombinedVueInstance } from 'vue/types/vue'
import type { NuxtRuntimeConfig } from '../config/runtime'
import type { Context, Middleware, Transition, NuxtApp } from './index'

// https://github.com/vuejs/vue/blob/dev/types/options.d.ts#L63-L66
type DefaultData<V> = object | ((this: V) => object)
type DefaultProps = Record<string, any>
type DefaultMethods<V> = { [key: string]: (this: V, ...args: any[]) => any }
type DefaultComputed = { [key: string]: any }
type DefaultAsyncData<V> = ((this: V, context: Context) => Promise<object | void> | object | void)

declare module 'vue/types/options' {
  interface ComponentOptions<
    V extends Vue,
    /* eslint-disable no-unused-vars,@typescript-eslint/no-unused-vars */
    Data = DefaultData<V>,
    Methods = DefaultMethods<V>,
    Computed = DefaultComputed,
    PropsDef = PropsDefinition<DefaultProps>,
    Props = DefaultProps,
    RawBindings = {},
    Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
    Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
    /* eslint-enable no-unused-vars,@typescript-eslint/no-unused-vars */
    AsyncData = DefaultAsyncData<V>
  > {
    // eslint-disable-next-line @typescript-eslint/ban-types
    asyncData?: AsyncData
    fetch?(ctx: Context): Promise<void> | void
    fetchKey?: string | ((getKey: (id: string) => number) => string)
    fetchDelay?: number
    fetchOnServer?: boolean | (() => boolean)
    head?: MetaInfo | (() => MetaInfo)
    key?: string | ((to: Route) => string)
    layout?: string | ((ctx: Context) => string)
    loading?: boolean
    middleware?: Middleware | Middleware[]
    scrollToTop?: boolean
    transition?: string | Transition | ((to: Route, from: Route | undefined) => string | Transition)
    validate?(ctx: Context): Promise<boolean> | boolean
    watchQuery?: boolean | string[] | ((newQuery: Route['query'], oldQuery: Route['query']) => boolean)
    meta?: { [key: string]: any }
  }
}

type DataDef<Data, Props, V> = Data | ((this: Readonly<Props> & V) => Data)
type Awaited<T> = T extends PromiseLike<infer U> ? Awaited<U> : T
type Merged<Data, AsyncData> = {
  [key in keyof Data | keyof AsyncData]: key extends keyof Data ? key extends keyof AsyncData ? NonNullable<Data[key]> | AsyncData[key] : Data[key] : key extends keyof AsyncData ? AsyncData[key] : never
}

type ThisTypedComponentOptionsWithArrayPropsAndAsyncData<
  V extends Vue,
  Data,
  Methods,
  Computed,
  PropNames extends string,
  SetupBindings,
  Mixin extends ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin,
  AsyncData extends DefaultAsyncData<V> = DefaultAsyncData<V>
> = object &
  ComponentOptions<
    V,
    DataDef<Data, Record<PropNames, any>, V>,
    Methods,
    Computed,
    PropNames[],
    Record<PropNames, any>,
    Merged<SetupBindings, Awaited<ReturnType<AsyncData>>>,
    Mixin,
    Extends,
    AsyncData
  > &
  ThisType<
    CombinedVueInstance<
      V,
      Merged<Data, Awaited<ReturnType<AsyncData>>>,
      Methods,
      Computed,
      Readonly<Record<PropNames, any>>,
      SetupBindings,
      Mixin,
      Extends
    >
  >
export type ThisTypedComponentOptionsWithRecordPropsAndAsyncData<
  V extends Vue,
  Data,
  Methods,
  Computed,
  Props,
  SetupBindings,
  Mixin extends ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin,
  AsyncData extends DefaultAsyncData<V>
> = object &
  ComponentOptions<
    V,
    DataDef<Data, Props, V>,
    Methods,
    Computed,
    RecordPropsDefinition<Props>,
    Props,
    Merged<SetupBindings, Awaited<ReturnType<AsyncData>>>,
    Mixin,
    Extends,
    AsyncData
  > &
  ThisType<
    CombinedVueInstance<
      V,
      Merged<Data, Awaited<ReturnType<AsyncData>>>,
      Methods,
      Computed,
      Readonly<Props>,
      SetupBindings,
      Mixin,
      Extends
    >
  >


declare module 'vue/types/vue' {
  interface Vue {
    $config: NuxtRuntimeConfig
    $nuxt: NuxtApp
    $fetch(): Promise<void> | void
    $fetchState: {
      error: Error | null
      pending: boolean
      timestamp: number
    }
  }
  interface VueConstructor<V extends Vue> {
    /** extend with array props */
    extend<
      Data,
      Methods,
      Computed,
      PropNames extends string = never,
      SetupBindings = {},
      Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
      Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
      AsyncData extends DefaultAsyncData<V> = DefaultAsyncData<V>
    >(
      options?: ThisTypedComponentOptionsWithArrayPropsAndAsyncData<
        V,
        Data,
        Methods,
        Computed,
        PropNames,
        SetupBindings,
        Mixin,
        Extends,
        AsyncData
      >
    ): ExtendedVue<
      V,
      Data,
      Methods,
      Computed,
      Record<PropNames, any>,
      Merged<SetupBindings, Awaited<ReturnType<AsyncData>>>,
      Mixin,
      Extends
    >

    /** extend with object props */
    extend<
      Data,
      Methods,
      Computed,
      Props,
      SetupBindings = {},
      Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
      Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
      AsyncData extends DefaultAsyncData<V> = DefaultAsyncData<V>
    >(
      options?: ThisTypedComponentOptionsWithRecordPropsAndAsyncData<
        V,
        Data,
        Methods,
        Computed,
        Props,
        SetupBindings,
        Mixin,
        Extends,
        AsyncData
      >
    ): ExtendedVue<
        V,
        Data,
        Methods,
        Computed,
        Props,
        Merged<SetupBindings, Awaited<ReturnType<AsyncData>>>,
        Mixin,
        Extends
      >
  }
}
