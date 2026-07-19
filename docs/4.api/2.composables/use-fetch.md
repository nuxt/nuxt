---
title: 'useFetch'
description: 'Fetch data from an API endpoint with an SSR-friendly composable.'
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/fetch.ts
    size: xs
---

This composable provides a convenient wrapper around [`useAsyncData`](/docs/4.x/api/composables/use-async-data) and [`$fetch`](/docs/4.x/api/utils/dollarfetch).
It automatically generates a key for the request, provides type hints for request url based on server routes, and infers API response type.

::note
`useFetch` is a composable meant to be called directly in a setup function, plugin, or route middleware. It returns reactive composables and handles adding responses to the Nuxt payload so they can be passed from server to client without re-fetching the data on client side when the page hydrates.
::

## Usage

```vue [app/pages/modules.vue]
<script setup lang="ts">
const { data, status, error, refresh, clear } = await useFetch('/api/modules', {
  pick: ['title'],
})
</script>
```

::tip{to="/docs/4.x/guide/recipes/custom-usefetch#custom-usefetch-with-createusefetch"}
Need a custom `useFetch` with pre-defined defaults (like `baseURL` or auth headers)? Use `createUseFetch` to create a fully typed custom composable.
::

::note
You do not need to `await` `useFetch`. On the server, Nuxt waits for the promise to resolve before rendering in either case, so the returned HTML always contains the data. The `await` affects what happens after the call: with it, execution pauses until `data` is populated, and client-side navigation is blocked until the data is ready; without it, execution continues immediately, `data` starts as its default value until the request resolves, and on client-side navigation you handle the loading and error states yourself using the returned `status` and `error` refs. This has a similar effect to the [`lazy`](#parameters) option, though `lazy` is the explicit way to opt into non-blocking navigation.
::

::note
`data`, `status`, and `error` are Vue refs, and they should be accessed with `.value` when used within the `<script setup>`, while `refresh`/`execute` and `clear` are plain functions.
::

Using the `query` option, you can add search parameters to your query. This option is extended from [unjs/ofetch](https://github.com/unjs/ofetch) and is using [unjs/ufo](https://github.com/unjs/ufo) to create the URL. Objects are automatically stringified.

```ts
const param1 = ref('value1')
const { data, status, error, refresh } = await useFetch('/api/modules', {
  query: { param1, param2: 'value2' },
})
```

The above example results in `https://api.nuxt.com/modules?param1=value1&param2=value2`.

You can also use [interceptors](https://github.com/unjs/ofetch#%EF%B8%8F-interceptors):

```ts
const { data, status, error, refresh, clear } = await useFetch('/api/auth/login', {
  onRequest ({ request, options }) {
    // Set the request headers
    // note that this relies on ofetch >= 1.4.0 - you may need to refresh your lockfile
    options.headers.set('Authorization', '...')
  },
  onRequestError ({ request, options, error }) {
    // Handle the request errors
  },
  onResponse ({ request, response, options }) {
    // Process the response data
    localStorage.setItem('token', response._data.token)
  },
  onResponseError ({ request, response, options }) {
    // Handle the response errors
  },
})
```

### Reactive Keys and Shared State

You can use a computed ref or a plain ref as the URL, allowing for dynamic data fetching that automatically updates when the URL changes:

```vue [app/pages/[id\\].vue]
<script setup lang="ts">
const route = useRoute()
const id = computed(() => route.params.id)

// When the route changes and id updates, the data will be automatically refetched
const { data: post } = await useFetch(() => `/api/posts/${id.value}`)
</script>
```

The auto-generated key is unique to each call site, so calling `useFetch` with the same URL and options in different components will **not** share state and each call performs its own request. Multiple instances of the same component do share state, since they use the same call site. To share the same `data`, `error` and `status` refs across different components, provide the same explicit `key` to each call:

::code-group

```vue [app/components/ComponentA.vue]
<script setup lang="ts">
// shares the data with ComponentB - only one request is made
const { data } = await useFetch('/api/random', { key: 'random' })
</script>
```

```vue [app/components/ComponentB.vue]
<script setup lang="ts">
// shares the data with ComponentA - only one request is made
const { data } = await useFetch('/api/random', { key: 'random' })
</script>
```

::

::tip
Keyed state created using `useFetch` can be retrieved across your Nuxt application using [`useNuxtData`](/docs/4.x/api/composables/use-nuxt-data).
::

::warning
`useFetch` is a reserved function name transformed by the compiler, so you should not name your own function `useFetch`. To create a custom variant with pre-defined options, use [`createUseFetch`](/docs/4.x/guide/recipes/custom-usefetch#custom-usefetch-with-createusefetch) instead.
::

::warning
If you encounter the `data` variable destructured from a `useFetch` returns a string and not a JSON parsed object then make sure your component doesn't include an import statement like `import { useFetch } from '@vueuse/core`.
::

:video-accordion{title="Watch the video from Alexander Lichter to avoid using useFetch the wrong way" videoId="njsGVmcWviY"}

:read-more{to="/docs/4.x/getting-started/data-fetching"}

### Reactive Fetch Options

Fetch options can be provided as reactive, supporting `computed`, `ref` and [computed getters](https://vuejs.org/guide/essentials/computed). When a reactive fetch option is updated it will trigger a refetch using the updated resolved reactive value.

```ts
const searchQuery = ref('initial')
const { data } = await useFetch('/api/search', {
  query: { q: searchQuery },
})
// triggers a refetch: /api/search?q=new%20search
searchQuery.value = 'new search'
```

If needed, you can opt out of this behavior using `watch: false`:

```ts
const searchQuery = ref('initial')
const { data } = await useFetch('/api/search', {
  query: { q: searchQuery },
  watch: false,
})
// does not trigger a refetch
searchQuery.value = 'new search'
```

## Type

```ts [Signature]
export function useFetch<ResT, ErrorT = NuxtError<unknown>, DataT = ResT> (
  url: string | Request | Ref<string | Request> | (() => string | Request),
  options?: UseFetchOptions<ResT, DataT>,
): AsyncData<DataT, ErrorT> & Promise<AsyncData<DataT, ErrorT>>

type UseFetchOptions<ResT, DataT = ResT> = {
  key?: MaybeRefOrGetter<string>
  method?: MaybeRefOrGetter<string>
  query?: MaybeRefOrGetter<SearchParams>
  params?: MaybeRefOrGetter<SearchParams>
  body?: MaybeRefOrGetter<RequestInit['body'] | Record<string, any>>
  headers?: MaybeRefOrGetter<Record<string, string> | [key: string, value: string][] | Headers>
  baseURL?: MaybeRefOrGetter<string>
  cache?: false | 'default' | 'force-cache' | 'no-cache' | 'no-store' | 'only-if-cached' | 'reload'
  server?: boolean
  lazy?: boolean
  immediate?: boolean
  getCachedData?: (key: string, nuxtApp: NuxtApp, ctx: AsyncDataRequestContext) => DataT | undefined
  deep?: boolean
  dedupe?: 'cancel' | 'defer'
  timeout?: number
  enabled?: MaybeRefOrGetter<boolean>
  default?: () => DataT | Ref<DataT>
  transform?: (input: ResT) => DataT | Promise<DataT>
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
  pending: Ref<boolean>
  refresh: (opts?: AsyncDataExecuteOptions) => Promise<void>
  execute: (opts?: AsyncDataExecuteOptions) => Promise<void>
  clear: () => void
  error: Ref<ErrorT | undefined>
  status: Ref<AsyncDataRequestStatus>
}

interface AsyncDataExecuteOptions {
  dedupe?: 'cancel' | 'defer'
  timeout?: number
  signal?: AbortSignal
}

type AsyncDataRequestStatus = 'idle' | 'pending' | 'success' | 'error'
```

## Parameters

- `URL` (`string | Request | Ref<string | Request> | () => string | Request`): The URL or request to fetch. Can be a string, a Request object, a Vue ref, or a function returning a string/Request. Supports reactivity for dynamic endpoints.

- `options` (object): Configuration for the fetch request. Extends [unjs/ofetch](https://github.com/unjs/ofetch) options and [`AsyncDataOptions`](/docs/4.x/api/composables/use-async-data#parameters). All options can be a static value, a `ref`, or a computed value.

| Option                                                                    | Type                                                                    | Default    | Description                                                                                                                                                                                                                                                                        |
|---------------------------------------------------------------------------|-------------------------------------------------------------------------|------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `key`                                                                     | `MaybeRefOrGetter<string>`                                              | auto-gen   | Unique key for de-duplication. If not provided, generated from the URL, options and call site location in the source code.                                                                                                                                                         |
| `method`                                                                  | `MaybeRefOrGetter<string>`                                              | `'GET'`    | HTTP request method.                                                                                                                                                                                                                                                               |
| `query`                                                                   | `MaybeRefOrGetter<SearchParams>`                                        | -          | Query/search params to append to the URL. Alias: `params`.                                                                                                                                                                                                                         |
| `params`                                                                  | `MaybeRefOrGetter<SearchParams>`                                        | -          | Alias for `query`.                                                                                                                                                                                                                                                                 |
| `body`                                                                    | `MaybeRefOrGetter<RequestInit['body'] \| Record<string, any>>`          | -          | Request body. Objects are automatically stringified.                                                                                                                                                                                                                               |
| `headers`                                                                 | `MaybeRefOrGetter<Record<string, string> \| [key, value][] \| Headers>` | -          | Request headers.                                                                                                                                                                                                                                                                   |
| `baseURL`                                                                 | `MaybeRefOrGetter<string>`                                              | -          | Base URL for the request.                                                                                                                                                                                                                                                          |
| `cache`                                                                   | `false \| string`                                                       | -          | Cache control. Boolean disables cache, or use Fetch API values: `default`, `no-store`, etc.                                                                                                                                                                                        |
| `server`                                                                  | `boolean`                                                               | `true`     | Whether to fetch on the server.                                                                                                                                                                                                                                                    |
| `lazy`                                                                    | `boolean`                                                               | `false`    | If true, resolves after route loads (does not block navigation).                                                                                                                                                                                                                   |
| `immediate`                                                               | `boolean`                                                               | `true`     | If false, prevents request from firing immediately.                                                                                                                                                                                                                                |
| `default`                                                                 | `() => DataT`                                                           | -          | Factory for default value of `data` before async resolves.                                                                                                                                                                                                                         |
| `timeout` :badge[v4.2]{color="info" size="xs" class="align-middle"}       | `number`                                                                | -          | A number in milliseconds to wait before timing out the request (defaults to `undefined`, which means no timeout)                                                                                                                                                                   |
| `transform`                                                               | `(input: DataT) => DataT \| Promise<DataT>`                             | -          | Function to transform the result after resolving.                                                                                                                                                                                                                                  |
| `getCachedData` :badge[v3.8]{color="info" size="xs" class="align-middle"} | `(key, nuxtApp, ctx) => DataT \| undefined`                             | -          | Function to return cached data. See below for default.                                                                                                                                                                                                                             |
| `pick`                                                                    | `string[]`                                                              | -          | Only pick specified keys from the result.                                                                                                                                                                                                                                          |
| `watch`                                                                   | `MultiWatchSources \| false`                                            | -          | Array of reactive sources to watch and auto-refresh. `false` disables watching.                                                                                                                                                                                                    |
| `deep` :badge[v3.8]{color="info" size="xs" class="align-middle"}          | `boolean`                                                               | `false`    | Return data in a deep ref object. Defaults to `false` for improved performance (shallow ref object).                                                                                                                                                                               |
| `dedupe` :badge[v3.9]{color="info" size="xs" class="align-middle"}        | `'cancel' \| 'defer'`                                                   | `'cancel'` | Avoid fetching same key more than once at a time.                                                                                                                                                                                                                                  |
| `enabled` :badge[v4.5]{color="info" size="xs" class="align-middle"}       | `boolean`                                                               | `true`     | Barrier that gates whether the request may run. While `false`, every execution is blocked (initial fetch, `execute`/`refresh`, and watch triggers), and switching `true` → `false` cancels any in-flight request without clearing `data`. Re-enabling does not refetch on its own. |
| `$fetch` :badge[v3.2]{color="info" size="xs" class="align-middle"}        | `typeof globalThis.$fetch`                                              | -          | Custom $fetch implementation. See [Custom useFetch in Nuxt](/docs/4.x/guide/recipes/custom-usefetch)                                                                                                                                                                               |

::note
All fetch options can be given a `computed` or `ref` value. These will be watched and new requests made automatically with any new values if they are updated (unless `watch` is set to `false`).
::

**getCachedData default:**

```ts
const getDefaultCachedData = (key, nuxtApp, ctx) => nuxtApp.isHydrating
  ? nuxtApp.payload.data[key]
  : nuxtApp.static.data[key]
```
This only caches data when `experimental.payloadExtraction` in `nuxt.config` is enabled.

## Return Values

This composable returns a `Promise` that can be awaited, which makes it possible to use `data` directly within the `<script setup>` (i.e. a value will be present, instead of being undefined). You can also directly pull the values without awaiting the return value, in which case `data` can be undefined within `<script setup>` until the fetch completes.

::tip
Even if you do not await the return value, during SSR Nuxt will wait for the request to finish and send the resolved data to the client.
::

::note
If you have not fetched data on the server (for example, with `server: false`), then the data _will not_ be fetched until hydration completes. This means even if you await `useFetch` on client-side, `data` will remain undefined within `<script setup>`.
::

| Name      | Type                                                | Description                                                                                                                                                       |
|-----------|-----------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `data`    | `Ref<DataT \| undefined>`                           | The result of the asynchronous fetch.                                                                                                                             |
| `refresh` | `(opts?: AsyncDataExecuteOptions) => Promise<void>` | Function to manually refresh the data. By default, Nuxt waits until a `refresh` is finished before it can be executed again.                                      |
| `execute` | `(opts?: AsyncDataExecuteOptions) => Promise<void>` | Alias for `refresh`.                                                                                                                                              |
| `error`   | `Ref<ErrorT \| undefined>`                          | Error object if the data fetching failed.                                                                                                                         |
| `status`  | `Ref<'idle' \| 'pending' \| 'success' \| 'error'>`  | Status of the data request. See below for possible values.                                                                                                        |
| `pending` | `Ref<boolean>`                                      | Boolean flag indicating whether the current request is in progress.                                                                                               |
| `clear`   | `() => void`                                        | Resets `data` to `undefined` (or the value of `options.default()` if provided), `error` to `undefined`, set `status` to `idle`, and cancels any pending requests. |

::tip
Functions from the `Promise` (`then`, `catch`, and `finally`) can safely be destructured, if you did not await the return value.
::

### Status values

- `idle`: Request has not started (e.g. `{ immediate: false }` or `{ server: false }` on server render)
- `pending`: Request is in progress
- `success`: Request completed successfully
- `error`: Request failed

### Examples

:link-example{to="/docs/4.x/examples/advanced/use-custom-fetch-composable"}

:link-example{to="/docs/4.x/examples/features/data-fetching"}
