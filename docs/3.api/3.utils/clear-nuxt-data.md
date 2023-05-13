# `clearNuxtData`

Delete cached data, error status, and pending promises of `useAsyncData` and `useFetch`.

This method is practical for invalidating data fetching for another page.

## Type

```ts
clearNuxtData (keys?: string | string[] | ((key: string) => boolean)): void
```

## Parameters

* `keys`: One or an array of keys used in `useAsyncData` to delete their cached data. With no keys provided, **all the data** will be invalidated.
