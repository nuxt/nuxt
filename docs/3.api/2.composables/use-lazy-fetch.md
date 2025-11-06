---
title: 'useLazyFetch'
description: This wrapper around useFetch triggers navigation immediately.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/fetch.ts
    size: xs
---

`useLazyFetch` provides a wrapper around [`useFetch`](/docs/3.x/api/composables/use-fetch) that triggers navigation before the handler is resolved by setting the `lazy` option to `true`.

## Usage

By default, [`useFetch`](/docs/3.x/api/composables/use-fetch) blocks navigation until its async handler is resolved. `useLazyFetch` allows navigation to proceed immediately, with data being fetched in the background.

```vue [app/pages/index.vue]
<script setup lang="ts">
const { status, data: posts } = await useLazyFetch('/api/posts')
</script>

<template>
  <div v-if="status === 'pending'">
    Loading ...
  </div>
  <div v-else>
    <div v-for="post in posts">
      <!-- do something -->
    </div>
  </div>
</template>
```

::note
`useLazyFetch` has the same signature as [`useFetch`](/docs/3.x/api/composables/use-fetch).
::

::warning
Awaiting `useLazyFetch` only ensures the call is initialized. On client-side navigation, data may not be immediately available, and you must handle the `pending` state in your component's template.
::

::warning
`useLazyFetch` is a reserved function name transformed by the compiler, so you should not name your own function `useLazyFetch`.
::

## Type

```ts [Signature]
export function useLazyFetch<DataT, ErrorT> (
  url: string | Request | Ref<string | Request> | (() => string | Request),
  options?: UseFetchOptions<DataT>
): Promise<AsyncData<DataT, ErrorT>>
```

::note
`useLazyFetch` is equivalent to `useFetch` with `lazy: true` option set. See [`useFetch`](/docs/3.x/api/composables/use-fetch) for full type definitions.
::

## Parameters

`useLazyFetch` accepts the same parameters as [`useFetch`](/docs/3.x/api/composables/use-fetch):

- `URL` (`string | Request | Ref<string | Request> | () => string | Request`): The URL or request to fetch.
- `options` (object): Same as [`useFetch` options](/docs/3.x/api/composables/use-fetch#parameters), with `lazy` automatically set to `true`.

:read-more{to="/docs/3.x/api/composables/use-fetch#parameters"}

## Return Values

Returns the same `AsyncData` object as [`useFetch`](/docs/3.x/api/composables/use-fetch):

| Name | Type | Description |
| --- | --- |--- |
| `data` | `Ref<DataT \| undefined>` | The result of the asynchronous fetch. |
| `refresh` | `(opts?: AsyncDataExecuteOptions) => Promise<void>` | Function to manually refresh the data. |
| `execute` | `(opts?: AsyncDataExecuteOptions) => Promise<void>` | Alias for `refresh`. |
| `error` | `Ref<ErrorT \| undefined>` | Error object if the data fetching failed. |
| `status` | `Ref<'idle' \| 'pending' \| 'success' \| 'error'>` | Status of the data request. |
| `clear` | `() => void` | Resets `data` to `undefined`, `error` to `undefined`, sets `status` to `idle`, and cancels any pending requests. |

:read-more{to="/docs/3.x/api/composables/use-fetch#return-values"}

## Examples

### Handling Pending State

```vue [pages/index.vue]
<script setup lang="ts">
/* Navigation will occur before fetching is complete.
 * Handle 'pending' and 'error' states directly within your component's template
 */
const { status, data: posts } = await useLazyFetch('/api/posts')
watch(posts, (newPosts) => {
  // Because posts might start out null, you won't have access
  // to its contents immediately, but you can watch it.
})
</script>

<template>
  <div v-if="status === 'pending'">
    Loading ...
  </div>
  <div v-else>
    <div v-for="post in posts">
      <!-- do something -->
    </div>
  </div>
</template>
```

:read-more{to="/docs/3.x/getting-started/data-fetching"}
