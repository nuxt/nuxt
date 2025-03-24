---
title: 'refreshNuxtData'
description: Refresh all or specific asyncData instances in Nuxt
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/asyncData.ts
    size: xs
---

`refreshNuxtData` is used to refetch all or specific `asyncData` instances, including those from [`useAsyncData`](/docs/api/composables/use-async-data), [`useLazyAsyncData`](/docs/api/composables/use-lazy-async-data), [`useFetch`](/docs/api/composables/use-fetch), and [`useLazyFetch`](/docs/api/composables/use-lazy-fetch).  

::note
If your component is cached by `<KeepAlive>` and enters a deactivated state, the `asyncData` inside the component will still be refetched until the component is unmounted.
::

## Type

```ts
refreshNuxtData(keys?: string | string[])
```

## Parameters

* `keys`: A single string or an array of strings as `keys` that are used to fetch the data. This parameter is **optional**. All [`useAsyncData`](/docs/api/composables/use-async-data) and [`useFetch`](/docs/api/composables/use-fetch) keys are re-fetched when no `keys` are explicitly specified.

## Return Values

`refreshNuxtData` returns a promise, resolving when all or specific `asyncData` instances have been refreshed.

## Examples

### Refresh All Data

This example below refreshes all data being fetched using `useAsyncData` and `useFetch` in Nuxt application.

```vue [pages/some-page.vue]
<script setup lang="ts">
const refreshing = ref(false)

async function refreshAll () {
  refreshing.value = true
  try {
    await refreshNuxtData()
  } finally {
    refreshing.value = false
  }
}
</script>

<template>
  <div>
    <button :disabled="refreshing" @click="refreshAll">
      Refetch All Data
    </button>
  </div>
</template>
```

### Refresh Specific Data

This example below refreshes only data where the key matches to `count`.

::code-group
```vue [pages/some-page.vue]
<script setup lang="ts">
const refreshing = ref(false)
const { data: count, refresh, status } = await useAsyncData('count', () => $fetch('/api/count'))
</script>

<template>
  <div>
    {{ status === 'pending' ? 'Loading' : count }}
  </div>
  <button @click="refresh">Refresh</button>
</template>
```
```ts [api/count.ts]
export default defineEventHandler(() => {
  return { count: 1 }
})
```

::

::note
If you have access to the `asyncData` instance, it is recommended to use its `refresh` or `execute` method as the preferred way to refetch the data.
::

:read-more{to="/docs/getting-started/data-fetching"}
