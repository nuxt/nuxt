---
title: 'defineUseAsyncDataAddon'
description: Define a reusable addon that extends composables created with createUseAsyncData.
minimalVersion: "4.6"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/addons.ts
    size: xs
---

`defineUseAsyncDataAddon` defines a reusable extension for `useAsyncData` composables created with [`createUseAsyncData`](/docs/4.x/api/composables/create-use-async-data).

An addon can declare custom call-site options, wrap the handler with middleware, attach custom reactive logic or extend the returned object.

:read-more{to="/docs/4.x/api/utils/define-use-fetch-addon" title="defineUseFetchAddon: Addons for useAsyncData work the same way as useFetch addons"}

## Usage

For example, an addon adding a `pollEvery` option that refreshes the data on an interval:

```ts [app/composables/usePolledAsyncData.ts]
const polling = defineUseAsyncDataAddon({
  setup: (options: UseAsyncDataAddonOptions<{ pollEvery?: number }>) => {
    if (import.meta.server || !options.pollEvery) { return }
    return (asyncData) => {
      const interval = setInterval(() => asyncData.refresh(), options.pollEvery)
      onScopeDispose(() => clearInterval(interval))
    }
  },
})

export const usePolledAsyncData = createUseAsyncData({ addons: [polling] })
```

```vue [app/pages/index.vue]
<script setup lang="ts">
// refreshes the data every 30 seconds
const { data } = await usePolledAsyncData(
  'mountains',
  () => $fetch('https://api.nuxtjs.dev/mountains'),
  { pollEvery: 30_000 },
)
</script>
```

::note
Addons run in the order of the `addons` array, with middleware from the first addon as the outermost wrapper. Listing the same addon object more than once runs it only once.
::

## Type

```ts [Signature]
function defineUseAsyncDataAddon<Opts extends Record<string, any> = {}, Ext = {}> (addon: {
  setup: (options: UseAsyncDataAddonOptions<Opts>) => ((asyncData: AsyncDataAddonInstance) => Ext | void) | void
}): UseAsyncDataAddon<Opts, Ext>
```
