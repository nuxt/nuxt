---
title: "refreshNuxtData"
description: refreshNuxtData refetches all data from the server and updates the page.
---

# `refreshNuxtData`

`refreshNuxtData` re-fetches all data from the server and updates the page as well as invalidates the cache of `useAsyncData`, `useLazyAsyncData`, `useFetch` and `useLazyFetch`.

## Type

```ts
refreshNuxtData(keys?: string | string[])
```

**Parameters:**

* `keys`:

    **Type**: `String | String[]`

    `refreshNuxtData` accepts a single or an array of strings as `keys` that are used to fetch the data. This parameter is **optional**. All `useAsyncData` and `useFetch` are re-fetched when no `keys` are specified.

## Examples

### Refresh All data

This example below refreshes all data being fetched using `useAsyncData` and `useFetch` on the current page.

```vue [pages/some-page.vue]
<template>
  <div>
    <button :disabled="refreshing" @click="refreshAll">
      Refetch All Data
    </button>
  </div>
</template>

<script setup>
const refreshing = ref(false)
const refreshAll = async () => {
  refreshing.value = true
  try {
    await refreshNuxtData()
  } finally {
    refreshing.value = false
  }
}
</script>
```

### Refresh Specific Data

This example below refreshes only data where the key matches to `count`.

```vue [pages/some-page.vue]
<template>
  <div>
    {{ pending ? 'Loading' : count }}
  </div>
  <button @click="refresh">Refresh</button>
</template>

<script setup>
const { pending, data: count } = useLazyAsyncData('count', () => $fetch('/api/count'))
const refresh = () => refreshNuxtData('count')
</script>
```

::ReadMore{link="/getting-started/data-fetching"}
::
