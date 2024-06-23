---
title: 'useFetch'
description: 'Fetch data from an API endpoint with an SSR-friendly composable.'
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/fetch.ts
    size: xs
---

This composable provides a convenient wrapper around [`useAsyncData`](/docs/api/composables/use-async-data) and [`$fetch`](/docs/api/utils/dollarfetch).
It automatically generates a key based on URL and fetch options, provides type hints for request url based on server routes, and infers API response type.

::note
`useFetch` is a composable meant to be called directly in a setup function, plugin, or route middleware. It returns reactive composables and handles adding responses to the Nuxt payload so they can be passed from server to client without re-fetching the data on client side when the page hydrates.
::

## Usage

```vue [pages/modules.vue]
<script setup lang="ts">
const { data, pending, error, refresh, clear } = await useFetch('/api/modules', {
  pick: ['title']
})
</script>
```

::warning
If you're using a custom useFetch wrapper, do not await it in the composable, as that can cause unexpected behavior. Please follow [this recipe](/docs/guide/recipes/custom-usefetch#custom-usefetch) for more information on how to make a custom async data fetcher.
::

::note
`data`, `pending`, `status` and `error` are Vue refs and they should be accessed with `.value` when used within the `<script setup>`, while `refresh`/`execute` and `clear` are plain functions..
::

Using the `query` option, you can add search parameters to your query. This option is extended from [unjs/ofetch](https://github.com/unjs/ofetch) and is using [unjs/ufo](https://github.com/unjs/ufo) to create the URL. Objects are automatically stringified.

```ts
const param1 = ref('value1')
const { data, pending, error, refresh } = await useFetch('/api/modules', {
  query: { param1, param2: 'value2' }
})
```

The above example results in `https://api.nuxt.com/modules?param1=value1&param2=value2`.

You can also use [interceptors](https://github.com/unjs/ofetch#%EF%B8%8F-interceptors):

```ts
const { data, pending, error, refresh, clear } = await useFetch('/api/auth/login', {
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

::warning
`useFetch` is a reserved function name transformed by the compiler, so you should not name your own function `useFetch`.
::

::tip{icon="i-ph-video-duotone" to="https://www.youtube.com/watch?v=njsGVmcWviY" target="_blank"}
Watch the video from Alexander Lichter to avoid using `useFetch` the wrong way!
::

:link-example{to="/docs/examples/advanced/use-custom-fetch-composable"}

:read-more{to="/docs/getting-started/data-fetching"}

:link-example{to="/docs/examples/features/data-fetching"}

## Params

- `URL`: The URL to fetch.
- `Options` (extends [unjs/ofetch](https://github.com/unjs/ofetch) options & [AsyncDataOptions](/docs/api/composables/use-async-data#params)):
  - `method`: Request method.
  - `query`: Adds query search params to URL using [ufo](https://github.com/unjs/ufo)
  - `params`: Alias for `query`
  - `body`: Request body - automatically stringified (if an object is passed).
  - `headers`: Request headers.
  - `baseURL`: Base URL for the request.
  - `timeout`: Milliseconds to automatically abort request
  - `cache`: Handles cache control according to [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/fetch#cache)
    - You can pass boolean to disable the cache or you can pass one of the following values: `default`, `no-store`, `reload`, `no-cache`, `force-cache`, and `only-if-cached`.

::note
All fetch options can be given a `computed` or `ref` value. These will be watched and new requests made automatically with any new values if they are updated.
::

- `Options` (from [`useAsyncData`](/docs/api/composables/use-async-data)):
  - `key`: a unique key to ensure that data fetching can be properly de-duplicated across requests, if not provided, it will be automatically generated based on URL and fetch options
  - `server`: whether to fetch the data on the server (defaults to `true`)
  - `lazy`: whether to resolve the async function after loading the route, instead of blocking client-side navigation (defaults to `false`)
  - `immediate`: when set to `false`, will prevent the request from firing immediately. (defaults to `true`)
  - `default`: a factory function to set the default value of the `data`, before the async function resolves - useful with the `lazy: true` or `immediate: false` option
  - `transform`: a function that can be used to alter `handler` function result after resolving
  - `getCachedData`: Provide a function which returns cached data. A _null_ or _undefined_ return value will trigger a fetch. By default, this is: `key => nuxt.isHydrating ? nuxt.payload.data[key] : nuxt.static.data[key]`, which only caches data when `payloadExtraction` is enabled.
  - `pick`: only pick specified keys in this array from the `handler` function result
  - `watch`: watch an array of reactive sources and auto-refresh the fetch result when they change. Fetch options and URL are watched by default. You can completely ignore reactive sources by using `watch: false`. Together with `immediate: false`, this allows for a fully-manual `useFetch`. (You can [see an example here](/docs/getting-started/data-fetching#watch) of using `watch`.)
  - `deep`: return data in a deep ref object (it is `true` by default). It can be set to `false` to return data in a shallow ref object, which can improve performance if your data does not need to be deeply reactive.
  - `dedupe`: avoid fetching same key more than once at a time (defaults to `cancel`). Possible options:
    - `cancel` - cancels existing requests when a new one is made
    - `defer` - does not make new requests at all if there is a pending request

::note
If you provide a function or ref as the `url` parameter, or if you provide functions as arguments to the `options` parameter, then the `useFetch` call will not match other `useFetch` calls elsewhere in your codebase, even if the options seem to be identical. If you wish to force a match, you may provide your own key in `options`.
::

::note
If you use `useFetch` to call an (external) HTTPS URL with a self-signed certificate in development, you will need to set `NODE_TLS_REJECT_UNAUTHORIZED=0` in your environment.
::

::tip{icon="i-simple-icons-youtube" color="gray" to="https://www.youtube.com/watch?v=aQPR0xn-MMk" target="_blank"}
Learn how to use `transform` and `getCachedData` to avoid superfluous calls to an API and cache data for visitors on the client.
::

## Return Values

- `data`: the result of the asynchronous function that is passed in.
- `pending`: a boolean indicating whether the data is still being fetched.
- `refresh`/`execute`: a function that can be used to refresh the data returned by the `handler` function.
- `error`: an error object if the data fetching failed.
- `status`: a string indicating the status of the data request (`"idle"`, `"pending"`, `"success"`, `"error"`).
- `clear`: a function which will set `data` to `undefined`, set `error` to `null`, set `pending` to `false`, set `status` to `'idle'`, and mark any currently pending requests as cancelled.

By default, Nuxt waits until a `refresh` is finished before it can be executed again.

::note
If you have not fetched data on the server (for example, with `server: false`), then the data _will not_ be fetched until hydration completes. This means even if you await `useFetch` on client-side, `data` will remain null within `<script setup>`.
::

## Type

```ts [Signature]
function useFetch<DataT, ErrorT>(
  url: string | Request | Ref<string | Request> | () => string | Request,
  options?: UseFetchOptions<DataT>
): Promise<AsyncData<DataT, ErrorT>>

type UseFetchOptions<DataT> = {
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
  getCachedData?: (key: string, nuxtApp: NuxtApp) => DataT
  deep?: boolean
  dedupe?: 'cancel' | 'defer'
  default?: () => DataT
  transform?: (input: DataT) => DataT | Promise<DataT>
  pick?: string[]
  watch?: WatchSource[] | false
}

type AsyncData<DataT, ErrorT> = {
  data: Ref<DataT | null>
  pending: Ref<boolean>
  refresh: (opts?: AsyncDataExecuteOptions) => Promise<void>
  execute: (opts?: AsyncDataExecuteOptions) => Promise<void>
  clear: () => void
  error: Ref<ErrorT | null>
  status: Ref<AsyncDataRequestStatus>
}

interface AsyncDataExecuteOptions {
  dedupe?: 'cancel' | 'defer'
}

type AsyncDataRequestStatus = 'idle' | 'pending' | 'success' | 'error'
```
