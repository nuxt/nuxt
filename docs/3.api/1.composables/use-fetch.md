# `useFetch`

This composable provides a convenient wrapper around [`useAsyncData`](/docs/api/composables/use-async-data) and [`$fetch`](/docs/api/utils/dollarfetch).

It automatically generates a key based on URL and fetch options, provides type hints for request URLs based on server routes, and infers the API response type.

## Type

```ts [Signature]
function useFetch(
  url: string | Request | Ref<string | Request> | () => string | Request,
  options?: UseFetchOptions<DataT>
): Promise<AsyncData<DataT>>

type UseFetchOptions = {
  key?: string
  method?: string
  query?: SearchParams
  params?: SearchParams
  body?: RequestInit['body'] | Record<string, any>
  headers?: Record<string, string> | [key: string, value: string][] | Headers
  baseURL?: string
  server?: boolean
  lazy?: boolean
  immediate?: boolean
  default?: () => DataT
  transform?: (input: DataT) => DataT
  pick?: string[]
  watch?: WatchSource[]
}

type AsyncData<DataT> = {
  data: Ref<DataT>
  pending: Ref<boolean>
  refresh: (opts?: { dedupe?: boolean }) => Promise<void>
  execute: () => Promise<void>
  error: Ref<Error | boolean>
}
```

## Params

* **URL**: The URL to fetch.
* **Options (extends [unjs/ofetch](https://github.com/unjs/ofetch) options & [AsyncDataOptions](/docs/api/composables/use-async-data#params))**:
  * `method`: Request method.
  * `query`: Adds query search params to URL using [ufo](https://github.com/unjs/ufo)
  * `params`: Alias for `query`
  * `body`: Request body - automatically stringified (if an object gets passed).
  * `headers`: Request headers.
  * `baseURL`: Base URL for the request.

::alert{type=info}
All fetch options can have a `computed` or `ref` value. They will be watched, and new requests will automatically be made with any new values if updated.
::

* **Options (from `useAsyncData`)**:
  * `key`: a unique key ensuring data fetching can be properly de-duplicated across requests. If not provided, it will be generated based on the (static) code location where `useAsyncData` is used.
  * `server`: Whether to fetch the data on the server (defaults to `true`).
  * `default`: A factory function to set the default value of the data before the async function resolves - particularly useful with the `lazy: true` option.
  * `pick`: Only pick specified keys in this array from the `handler` function result.
  * `watch`: Watch an array of reactive sources and auto-refresh the fetch result when they change. By default, fetch options and URLs get watched. You can completely ignore reactive sources by using `watch: false`. Together with `immediate: false`, this allows for a fully-manual `useFetch`.
  * `transform`: A function that can alter the `handler` function result after resolving.
  * `immediate`: When set to `false` will prevent the request from firing immediately. (defaults to `true`)

::alert{type=warning}
If you provide a function or ref as the `url` parameter, or if you provide functions as arguments to the `options` parameter, then the `useFetch` call will not match other `useFetch` calls elsewhere in your codebase, even if the options seem to be identical. You may provide your custom key in `options` to force a match if you'd like.
::

## Return Values

* **data**: the result of the asynchronous function passed.
* **pending**: a boolean indicating whether the data is in the process of being fetched.
* **refresh**/**execute**: a function that can refresh the data returned by the `handler` function.
* **error**: an error object if the fetching failed.

By default, Nuxt waits until a `refresh` is finished before being re-executable.

::alert{type=warning}
If you have not fetched data on the server (for example, with `server: false`), then the data _will not_ be fetched until hydration completes. That means even if you await `useFetch` on the client side, `data` will remain null within `<script setup>`.
::

## Example

```ts
const { data, pending, error, refresh } = await useFetch('https://api.nuxtjs.dev/mountains',{
    pick: ['title']
})
```

Adding Query Search Params:

You can add search parameters to your query using the `query` option. This option is extended from [unjs/ofetch](https://github.com/unjs/ofetch) and uses [unjs/ufo](https://github.com/unjs/ufo) to create the URL. Objects automatically get stringified.

```ts
const param1 = ref('value1')
const { data, pending, error, refresh } = await useFetch('https://api.nuxtjs.dev/mountains',{
    query: { param1, param2: 'value2' }
})
```

Results in `https://api.nuxtjs.dev/mountains?param1=value1&param2=value2`

Using [interceptors](https://github.com/unjs/ofetch#%EF%B8%8F-interceptors):

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
    localStorage.setItem('token', response._data.token)
  },
  onResponseError({ request, response, options }) {
    // Handle the response errors
  }
})
```

::alert{type=warning}
`useFetch` is a reserved function name transformed by the compiler, so you should not name your function `useFetch`.
::

::LinkExample{link="/docs/examples/other/use-custom-fetch-composable"}
::

:ReadMore{link="/docs/getting-started/data-fetching"}

::LinkExample{link="/docs/examples/composables/use-fetch"}
::
