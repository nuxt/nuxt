---
title: 'clearNuxtData'
description: Delete cached data, error status and pending promises of useAsyncData and useFetch.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/asyncData.ts
    size: xs
---

::callout
This method is useful if you want to invalidate the data fetching for another page.
::

## Type

```ts
clearNuxtData (keys?: string | string[] | ((key: string) => boolean)): void
```

## Parameters

* `keys`: One or an array of keys that are used in [`useAsyncData`](/docs/api/composables/use-async-data) to delete their cached data. If no keys are provided, **all data** will be invalidated.
