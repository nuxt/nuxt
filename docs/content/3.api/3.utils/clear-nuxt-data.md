# `clearNuxtData`

Delete cached data, error status and pending promises of `useAsyncData` and `useFetch`.

This method is useful if you want to invalidate the data fetching for another page.

## Type

```ts
clearNuxtData (keys?: string | string[] | ((key: string) => boolean)): void
```

## Parameters

* `keys`: On or an array of keys that are used in `useAsyncData` to delete their cached data. If no keys are provided, **every data** will be invalidated.
