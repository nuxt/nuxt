# `clearNuxtData`

Delete cached data, error status and pending promises of [`useAsyncData`](/docs/api/composables/use-async-data) and `useFetch`.

This method is useful if you want to invalidate the data fetching for another page.

## Type

```ts
clearNuxtData (keys?: string | string[] | ((key: string) => boolean)): void
```

## Parameters

* `keys`: One or an array of keys that are used in [`useAsyncData`](/docs/api/composables/use-async-data) to delete their cached data. If no keys are provided, **all data** will be invalidated.
