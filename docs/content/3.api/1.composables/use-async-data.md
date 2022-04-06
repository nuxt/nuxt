# `useAsyncData`

::ReadMore{link="/guide/features/data-fetching"}
::

```ts
const {
  data: Ref<DataT>,
  pending: Ref<boolean>,
  refresh: () => Promise<void>,
  error?: any
} = useAsyncData(
  key: string,
  handler: (ctx?: NuxtApp) => Promise<Object>,
  options?: {
    lazy: boolean,
    server: boolean,
    watch: WatchSource[]
  }
)
```

## Params

* **key**: a unique key to ensure that data fetching can be properly de-duplicated across requests
* **handler**: an asynchronous function that returns a value
* **options**:
  * _lazy_: whether to resolve the async function after loading the route, instead of blocking navigation (defaults to `false`)
  * _default_: a factory function to set the default value of the data, before the async function resolves - particularly useful with the `lazy: true` option
  * _server_: whether to fetch the data on server-side (defaults to `true`)
  * _transform_: a function that can be used to alter `handler` function result after resolving
  * _pick_: only pick specified keys in this array from `handler` function result
  * _watch_: watch reactive sources to auto refresh
  * _initialCache_: When set to `false`, will skip payload cache for initial fetch. (defaults to `true`)

Under the hood, `lazy: false` uses `<Suspense>` to block the loading of the route before the data has been fetched. Consider using `lazy: true` and implementing a loading state instead for a snappier user experience.

## Return values

* **data**: the result of the asynchronous function that is passed in
* **pending**: a boolean indicating whether the data is still being fetched
* **refresh**: a function that can be used to refresh the data returned by the `handler` function
* **error**: an error object if the data fetching failed

By default, Nuxt waits until a `refresh` is finished before it can be executed again. Passing `true` as parameter skips that wait.
