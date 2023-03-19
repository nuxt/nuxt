---
description: useAsyncData provides access to data that resolves asynchronously.
---
# `useAsyncData`

Within your pages, components, and plugins you can use useAsyncData to get access to data that resolves asynchronously.

## Type

```ts [Signature]
function useAsyncData(
  handler: (nuxtApp?: NuxtApp) => Promise<DataT>,
  options?: AsyncDataOptions<DataT>
): AsyncData<DataT>
function useAsyncData(
  key: string,
  handler: (nuxtApp?: NuxtApp) => Promise<DataT>,
  options?: AsyncDataOptions<DataT>
): Promise<AsyncData<DataT>>

type AsyncDataOptions<DataT> = {
  server?: boolean
  lazy?: boolean
  default?: () => DataT | Ref<DataT> | null
  transform?: (input: DataT) => DataT
  pick?: string[]
  watch?: WatchSource[]
  immediate?: boolean
}

interface RefreshOptions {
  dedupe?: boolean
}

type AsyncData<DataT, ErrorT> = {
  data: Ref<DataT | null>
  pending: Ref<boolean>
  execute: () => Promise<void>
  refresh: (opts?: RefreshOptions) => Promise<void>
  error: Ref<ErrorT | null>
}


```

## Params

* **key**: a unique key to ensure that data fetching can be properly de-duplicated across requests. If you do not provide a key, then a key that is unique to the file name and line number of the instance of `useAsyncData` will be generated for you.
* **handler**: an asynchronous function that returns a value
* **options**:
  * _lazy_: whether to resolve the async function after loading the route, instead of blocking client-side navigation (defaults to `false`)
  * _default_: a factory function to set the default value of the data, before the async function resolves - particularly useful with the `lazy: true` option
  * _server_: whether to fetch the data on the server (defaults to `true`)
  * _transform_: a function that can be used to alter `handler` function result after resolving
  * _pick_: only pick specified keys in this array from the `handler` function result
  * _watch_: watch reactive sources to auto-refresh
  * _immediate_: When set to `false`, will prevent the request from firing immediately. (defaults to `true`)

Under the hood, `lazy: false` uses `<Suspense>` to block the loading of the route before the data has been fetched. Consider using `lazy: true` and implementing a loading state instead for a snappier user experience.

## Return Values

* **data**: the result of the asynchronous function that is passed in
* **pending**: a boolean indicating whether the data is still being fetched
* **refresh**/**execute**: a function that can be used to refresh the data returned by the `handler` function
* **error**: an error object if the data fetching failed

By default, Nuxt waits until a `refresh` is finished before it can be executed again.

::alert{type=warning}
If you have not fetched data on the server (for example, with `server: false`), then the data _will not_ be fetched until hydration completes. This means even if you await `useAsyncData` on the client side, `data` will remain `null` within `<script setup>`.
::

## Example

```ts
const { data, pending, error, refresh } = await useAsyncData(
  'mountains',
  () => $fetch('https://api.nuxtjs.dev/mountains')
)
```

## Example with watching params change

The built-in `watch` option allows automatically rerunning the fetcher function when any changes are detected.

```ts
const page = ref(1)
const { data: posts } = await useAsyncData(
  'posts',
  () => $fetch('https://fakeApi.com/posts', {
    params: {
      page: page.value
    }
  }), {
    watch: [page]
  }
)
```

::alert{type=warning}
`useAsyncData` is a reserved function name transformed by the compiler, so you should not name your own function `useAsyncData`.
::

::ReadMore{link="/docs/getting-started/data-fetching"}
::
