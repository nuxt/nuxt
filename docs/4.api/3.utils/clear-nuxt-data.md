---
title: 'clearNuxtData'
description: Delete cached data, error status and pending promises of useAsyncData and useFetch.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/asyncData.ts
    size: xs
---

::note
This method is useful if you want to invalidate the data fetching for another page.
::

## Type

```ts [Signature]
export function clearNuxtData (keys?: string | string[] | ((key: string) => boolean) | ClearNuxtDataOptions, options?: ClearNuxtDataOptions): void
```

## Parameters

* `keys`: One or an array of keys that are used in [`useAsyncData`](/docs/4.x/api/composables/use-async-data) to delete their cached data. If no keys are provided, **all data** will be invalidated. You can also pass an options object directly as the first argument.
* `options`: Optional configuration object.
  * `scope`: Controls which category of cached data to clear. Defaults to `'all'`.
    * `'all'` — clear all async data (default)
    * `'async'` — clear only `useAsyncData` entries
    * `'fetch'` — clear only `useFetch` entries
    * `'island'` — clear only island component payload data

## Examples

```ts
// Clear all cached data
clearNuxtData()

// Clear a specific key
clearNuxtData('mykey')

// Clear only useFetch entries
clearNuxtData({ scope: 'fetch' })

// Clear a specific key, scoped to useAsyncData only
clearNuxtData('mykey', { scope: 'async' })

// Clear all island component data
clearNuxtData({ scope: 'island' })
```
