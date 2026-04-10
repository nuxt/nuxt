---
title: 'createUseAsyncData'
description: A factory function to create a custom useAsyncData composable with pre-defined default options.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/asyncData.ts
    size: xs
---

`createUseAsyncData` creates a custom [`useAsyncData`](/docs/4.x/api/composables/use-async-data) composable with pre-defined options. The resulting composable is fully typed and works exactly like `useAsyncData`, but with your defaults baked in.

::note
`createUseAsyncData` is a compiler macro. It must be used as an **exported** declaration in the `composables/` directory (or any directory scanned by the Nuxt compiler). Nuxt automatically injects de-duplication keys at build time.
::

## Usage

```ts [app/composables/useCachedData.ts]
export const useCachedData = createUseAsyncData({
  getCachedData (key, nuxtApp) {
    return nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
  },
})
```

```vue [app/pages/index.vue]
<script setup lang="ts">
const { data: mountains } = await useCachedData(
  'mountains',
  () => $fetch('https://api.nuxtjs.dev/mountains'),
)
</script>
```

The resulting composable has the same signature and return type as [`useAsyncData`](/docs/4.x/api/composables/use-async-data), with all options available for the caller to use or override.

## Type

```ts [Signature]
function createUseAsyncData (
  options?: Partial<AsyncDataOptions>,
): typeof useAsyncData

function createUseAsyncData (
  options: (callerOptions: AsyncDataOptions) => Partial<AsyncDataOptions>,
): typeof useAsyncData
```

## Options

`createUseAsyncData` accepts all the same options as [`useAsyncData`](/docs/4.x/api/composables/use-async-data#params), including `server`, `lazy`, `immediate`, `default`, `transform`, `pick`, `getCachedData`, `deep`, `dedupe`, `timeout`, and `watch`.

See the full list of options in the [`useAsyncData` documentation](/docs/4.x/api/composables/use-async-data#params).

## Default vs Override Mode

### Default Mode (plain object)

When you pass a plain object, the factory options act as **defaults**. Callers can override any option:

```ts [app/composables/useLazyData.ts]
export const useLazyData = createUseAsyncData({
  lazy: true,
  server: false,
})
```

```ts
// Uses the defaults (lazy: true, server: false)
const { data } = await useLazyData('key', () => fetchSomeData())

// Caller overrides server to true
const { data } = await useLazyData('key', () => fetchSomeData(), { server: true })
```

### Override Mode (function)

When you pass a function, the factory options **override** the caller's options. The function receives the caller's options as its argument:

```ts [app/composables/useStrictData.ts]
// deep is always enforced as false
export const useStrictData = createUseAsyncData(callerOptions => ({
  deep: false,
}))
```

:read-more{to="/docs/4.x/guide/recipes/custom-usefetch"}

:read-more{to="/docs/4.x/api/composables/use-async-data"}
