# `refreshNuxtData`

::ReadMore{link="/guide/features/data-fetching"}
::

```ts
refreshNuxtData(keys?: string | string[])
```

Available options:

* `keys`: Provides an array of keys that are used in `useAsyncData` to refetch. When it's not specified, all `useAsyncData` and `useFetch` will be refetched.
