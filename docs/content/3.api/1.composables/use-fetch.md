# `useFetch`

This composable provides a convenient wrapper around [`useAsyncData`](/api/composables/use-async-data) and [`$fetch`](/api/utils/$fetch). It automatically generates a key based on URL and fetch options, provides type hints for request url based on server routes, and infers API response type.

## Type

```ts [Signature]
function useFetch(
  url: string | Request | Ref<string | Request> | () => string | Request,
  options?: UseFetchOptions<DataT>
): Promise<AsyncData<DataT>>

type UseFetchOptions = {
  key?: string
  method?: string
  params?: SearchParams
  body?: RequestInit['body'] | Record<string, any>
  headers?: { key: string, value: string }[]
  baseURL?: string
  server?: boolean
  lazy?: boolean
  default?: () => DataT
  transform?: (input: DataT) => DataT
  pick?: string[]
  watch?: WatchSource[]
  initialCache?: boolean
}

type AsyncData<DataT> = {
  data: Ref<DataT>
  pending: Ref<boolean>
  refresh: () => Promise<void>
  error: Ref<Error | boolean>
}
```

## Params

* **Url**: The URL to fetch.
* **Options (extends [unjs/ohmyfetch](https://github.com/unjs/ohmyfetch) options & [AsyncDataOptions](/api/composables/use-async-data#params))**:
  * `method`: Request method.
  * `params`: Query params.
  * `body`: Request body - automatically stringified (if an object is passed).
  * `headers`: Request headers.
  * `baseURL`: Base URL for the request.
* **Options (from `useAsyncData`)**:
  * `key`: a unique key to ensure that data fetching can be properly de-duplicated across requests, if not provided, it will be generated based on the static code location where `useAyncData` is used.
  * `server`: Whether to fetch the data on the server (defaults to `true`).
  * `default`: A factory function to set the default value of the data, before the async function resolves - particularly useful with the `lazy: true` option.
  * `pick`: Only pick specified keys in this array from the `handler` function result.
  * `watch`: watch reactive sources to auto-refresh.
  * `initialCache`: When set to `false`, will skip payload cache for initial fetch (defaults to `true`).
  * `transform`: A function that can be used to alter `handler` function result after resolving.

::alert{type=warning}
If you provide a function or ref as the `url` parameter, or if you provide functions as arguments to the `options` parameter, then the `useFetch` call will not match other `useFetch` calls elsewhere in your codebase, even if the options seem to be identical. If you wish to force a match, you may provide your own key in `options`.
::

## Return Values

* **data**: the result of the asynchronous function that is passed in.
* **pending**: a boolean indicating whether the data is still being fetched.
* **refresh**: a function that can be used to refresh the data returned by the `handler` function.
* **error**: an error object if the data fetching failed.

By default, Nuxt waits until a `refresh` is finished before it can be executed again.

::alert{type=warning}
If you have not fetched data on the server (for example, with `server: false`), then the data _will not_ be fetched until hydration completes. This means even if you await `useFetch` on client-side, `data` will remain null within `<script setup>`.
::

## Example

```ts
const { data, pending, error, refresh } = await useFetch('https://api.nuxtjs.dev/mountains',{
    pick: ['title']
})
```

Using [interceptors](https://github.com/unjs/ohmyfetch#%EF%B8%8F-interceptors):

```ts
const { data, pending, error, refresh } = await useFetch('/api/auth/login', {
  onRequest({ request, options }) {
    // Set the request headers
    options.headers = options.headers || {}
    options.headers.authorization = '...'
  },
  onRequestError({ request, options, error }) {
    // Handle the request errors
  },
  onResponse({ request, response, options }) {
    // Process the response data
    return response._data
  },
  onResponseError({ request, response, options }) {
    // Pandle the response errors
  }
})
```

:ReadMore{link="/guide/features/data-fetching"}

:LinkExample{link="/examples/composables/use-fetch"}
