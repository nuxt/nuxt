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
const { data, status, error, refresh, clear } = await useFetch('/api/modules', {
  pick: ['title']
})
</script>
```

::warning
If you're using a custom useFetch wrapper, do not await it in the composable, as that can cause unexpected behavior. Please follow [this recipe](/docs/guide/recipes/custom-usefetch#custom-usefetch) for more information on how to make a custom async data fetcher.
::

::note
`data`, `status`, and `error` are Vue refs, and they should be accessed with `.value` when used within the `<script setup>`, while `refresh`/`execute` and `clear` are plain functions.
::

Using the `query` option, you can add search parameters to your query. This option is extended from [unjs/ofetch](https://github.com/unjs/ofetch) and is using [unjs/ufo](https://github.com/unjs/ufo) to create the URL. Objects are automatically stringified.

```ts
const param1 = ref('value1')
const { data, status, error, refresh } = await useFetch('/api/modules', {
  query: { param1, param2: 'value2' }
})
```

The above example results in `https://api.nuxt.com/modules?param1=value1&param2=value2`.

You can also use [interceptors](https://github.com/unjs/ofetch#%EF%B8%8F-interceptors):

```ts
const { data, status, error, refresh, clear } = await useFetch('/api/auth/login', {
  onRequest({ request, options }) {
    // Set the request headers
    // note that this relies on ofetch >= 1.4.0 - you may need to refresh your lockfile
    options.headers.set('Authorization', '...')
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

### Reactive Keys and Shared State

You can use a computed ref or a plain ref as the URL, allowing for dynamic data fetching that automatically updates when the URL changes:

```vue [pages/[id\\].vue]
<script setup lang="ts">
const route = useRoute()
const id = computed(() => route.params.id)

// When the route changes and id updates, the data will be automatically refetched
const { data: post } = await useFetch(() => `/api/posts/${id.value}`)
</script>
```

When using `useFetch` with the same URL and options in multiple components, they will share the same `data`, `error` and `status` refs. This ensures consistency across components.

::warning
`useFetch` is a reserved function name transformed by the compiler, so you should not name your own function `useFetch`.
::

::warning
If you encounter the `data` variable destructured from a `useFetch` returns a string and not a JSON parsed object then make sure your component doesn't include an import statement like `import { useFetch } from '@vueuse/core`.
::

:video-accordion{title="Watch the video from Alexander Lichter to avoid using useFetch the wrong way" videoId="njsGVmcWviY"}

:read-more{to="/docs/getting-started/data-fetching"}

## Type

```ts [Signature]
function useFetch<DataT, ErrorT>(
  url: string | Request | Ref<string | Request> | (() => string | Request),
  options?: UseFetchOptions<DataT>
): Promise<AsyncData<DataT, ErrorT>>

type UseFetchOptions<DataT> = {
  key?: MaybeRefOrGetter<string>
  method?: string
  query?: SearchParams
  params?: SearchParams
  body?: RequestInit['body'] | Record<string, any>
  headers?: Record<string, string> | [key: string, value: string][] | Headers
  baseURL?: string
  server?: boolean
  lazy?: boolean
  immediate?: boolean
  getCachedData?: (key: string, nuxtApp: NuxtApp, ctx: AsyncDataRequestContext) => DataT | undefined
  deep?: boolean
  dedupe?: 'cancel' | 'defer'
  default?: () => DataT
  transform?: (input: DataT) => DataT | Promise<DataT>
  pick?: string[]
  $fetch?: typeof globalThis.$fetch
  watch?: MultiWatchSources | false
}

type AsyncDataRequestContext = {
  /** The reason for this data request */
  cause: 'initial' | 'refresh:manual' | 'refresh:hook' | 'watch'
}

type AsyncData<DataT, ErrorT> = {
  data: Ref<DataT | undefined>
  refresh: (opts?: AsyncDataExecuteOptions) => Promise<void>
  execute: (opts?: AsyncDataExecuteOptions) => Promise<void>
  clear: () => void
  error: Ref<ErrorT | undefined>
  status: Ref<AsyncDataRequestStatus>
}

interface AsyncDataExecuteOptions {
  dedupe?: 'cancel' | 'defer'
}

type AsyncDataRequestStatus = 'idle' | 'pending' | 'success' | 'error'
```

## Parameters

- `URL` (`string | Request | Ref<string | Request> | () => string | Request`): The URL or request to fetch. Can be a string, a Request object, a Vue ref, or a function returning a string/Request. Supports reactivity for dynamic endpoints.

- `options` (object): Configuration for the fetch request. Extends [unjs/ofetch](https://github.com/unjs/ofetch) options and [`AsyncDataOptions`](/docs/api/composables/use-async-data#params). All options can be a static value, a `ref`, or a computed value.

| Option | Type | Default | Description |
| ---| --- | --- | --- |
| `key` | `MaybeRefOrGetter<string>` | auto-gen | Unique key for de-duplication. If not provided, generated from URL and options. |
| `method` | `string` | `'GET'` | HTTP request method. |
| `query` | `object` | - | Query/search params to append to the URL. Alias: `params`. Supports refs/computed. |
| `params` | `object` | - | Alias for `query`. |
| `body` | `RequestInit['body'] \| Record<string, any>` | - | Request body. Objects are automatically stringified. Supports refs/computed. |
| `headers` | `Record<string, string> \| [key, value][] \| Headers` | - | Request headers. |
| `baseURL` | `string` | - | Base URL for the request. |
| `timeout` | `number` | - | Timeout in milliseconds to abort the request. |
| `cache` | `boolean \| string` | - | Cache control. Boolean disables cache, or use Fetch API values: `default`, `no-store`, etc. |
| `server` | `boolean` | `true` | Whether to fetch on the server. |
| `lazy` | `boolean` | `false` | If true, resolves after route loads (does not block navigation). |
| `immediate` | `boolean` | `true` | If false, prevents request from firing immediately. |
| `default` | `() => DataT` | - | Factory for default value of `data` before async resolves. |
| `transform` | `(input: DataT) => DataT \| Promise<DataT>` | - | Function to transform the result after resolving. |
| `getCachedData`| `(key, nuxtApp, ctx) => DataT \| undefined` | - | Function to return cached data. See below for default. |
| `pick` | `string[]` | - | Only pick specified keys from the result. |
| `watch` | `MultiWatchSources \| false` | - | Array of reactive sources to watch and auto-refresh. `false` disables watching. |
| `deep` | `boolean` | `false` | Return data in a deep ref object. |
| `dedupe` | `'cancel' \| 'defer'` | `'cancel'` | Avoid fetching same key more than once at a time. |
| `$fetch` | `typeof globalThis.$fetch` | - | Custom $fetch implementation. |

::note
All fetch options can be given a `computed` or `ref` value. These will be watched and new requests made automatically with any new values if they are updated.
::

**getCachedData default:**

```ts
const getDefaultCachedData = (key, nuxtApp, ctx) => nuxtApp.isHydrating 
 ? nuxtApp.payload.data[key] 
 : nuxtApp.static.data[key]
```
This only caches data when `experimental.payloadExtraction` in `nuxt.config` is enabled.

## Return Values

| Name | Type | Description |
| --- | --- |--- |
| `data` | `Ref<DataT \| undefined>` | The result of the asynchronous fetch. |
| `refresh` | `(opts?: AsyncDataExecuteOptions) => Promise<void>` | Function to manually refresh the data. By default, Nuxt waits until a `refresh` is finished before it can be executed again. |
| `execute` | `(opts?: AsyncDataExecuteOptions) => Promise<void>` | Alias for `refresh`. |
| `error` | `Ref<ErrorT \| undefined>` | Error object if the data fetching failed. |
| `status` | `Ref<'idle' \| 'pending' \| 'success' \| 'error'>` | Status of the data request. See below for possible values. |
| `clear` | `() => void` | Resets `data` to `undefined` (or the value of `options.default()` if provided), `error` to `null`, set `status` to `idle`, and cancels any pending requests. |

### Status values

- `idle`: Request has not started (e.g. `{ immediate: false }` or `{ server: false }` on server render)
- `pending`: Request is in progress
- `success`: Request completed successfully
- `error`: Request failed

::note
If you have not fetched data on the server (for example, with `server: false`), then the data _will not_ be fetched until hydration completes. This means even if you await `useFetch` on client-side, `data` will remain null within `<script setup>`.
::

### Examples

:link-example{to="/docs/examples/advanced/use-custom-fetch-composable"}

:link-example{to="/docs/examples/features/data-fetching"}
