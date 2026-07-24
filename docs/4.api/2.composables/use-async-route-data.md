---
title: 'useAsyncRouteData'
description: useAsyncRouteData wraps useAsyncData with route-scoped keys and passes the current route to your handler.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/asyncRouteData.ts
    size: xs
---

:badge[v4.6+]

`useAsyncRouteData` is a thin wrapper around [`useAsyncData`](/docs/4.x/api/composables/use-async-data) for data that should refresh when the page path changes. It prefixes your key with an encoded `route.path`, passes the current route into the handler, and can validate the result (for example as a missing entity).

::note
Payload entries stay **flat** strings on `nuxtApp.payload.data` (for example `$r:%2Fposts%2F1:article`). Nested `payload.data[path][key]` is not used, so [`useNuxtData`](/docs/4.x/api/composables/use-nuxt-data), [`clearNuxtData`](/docs/4.x/api/utils/clear-nuxt-data), and refresh helpers keep working. Encoding the path keeps `/foo/bar` and `/foo-bar` distinct.
::

## Usage

```vue [app/pages/posts/[id\\].vue]
<script setup lang="ts">
const { data, error } = await useAsyncRouteData('post', (route, _nuxtApp, { signal }) => {
  return $fetch(`/api/posts/${route.params.id}`, { signal })
}, {
  validate: post => !!post,
})
</script>
```

When the path changes, Nuxt migrates to a new cache slot and runs the handler again with the updated route.

## Type

```ts [Signature]
export function useAsyncRouteData<ResT> (
  handler: (route, nuxtApp, { signal }) => Promise<ResT>,
  options?: AsyncRouteDataOptions<ResT>,
): AsyncData<ResT> & Promise<AsyncData<ResT>>

export function useAsyncRouteData<ResT> (
  key: MaybeRefOrGetter<string>,
  handler: (route, nuxtApp, { signal }) => Promise<ResT>,
  options?: AsyncRouteDataOptions<ResT>,
): AsyncData<ResT> & Promise<AsyncData<ResT>>
```

## Parameters

### `key`

A unique key within the current route. Combined with an encoded `route.path` into one payload key.

### `handler`

An asynchronous function. The first argument is the current route; the second and third match [`useAsyncData`](/docs/4.x/api/composables/use-async-data) (`nuxtApp`, `{ signal }`).

### `options`

All [`useAsyncData`](/docs/4.x/api/composables/use-async-data#params) options, plus:

#### `validate`

- **Type**: `(data: ResT, route) => boolean | { status?: number, statusText?: string } | Promise<...>`
- **Required**: false

If the result is not `true`, the composable rejects with a Nuxt error (default status `404`). On the server it also calls [`setResponseStatus`](/docs/4.x/api/utils/set-response-status) when a request event is available. The error is available on the returned `error` ref, same as other [`useAsyncData`](/docs/4.x/api/composables/use-async-data) failures. The result shape matches page `meta.validate` (`status` / `statusText`).

## Return Values

Same as [`useAsyncData`](/docs/4.x/api/composables/use-async-data#return-values): `data`, `pending`, `error`, `status`, `refresh` / `execute`, and `clear`.
