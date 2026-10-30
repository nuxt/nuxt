---
title: 'useFetchMutation'
description: Send a request to an API endpoint on demand, such as a form submission, and track its result.
minimalVersion: "4.7"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/fetchMutation.ts
    size: xs
---

`useFetchMutation` sends a request with [`$fetch`](/docs/api/utils/dollarfetch) when you call `mutate`, and tracks the result, status and error of the request in reactive refs. Use it for requests that change something, such as submitting a form, creating a record or deleting an item.

It works like [`useAsyncDataMutation`](/docs/api/composables/use-async-data-mutation) with a request as the handler: it never runs on its own, and its state is local to the component that called it. To read data when a page or component renders, use [`useFetch`](/docs/api/composables/use-fetch) instead.

## Usage

```vue [app/components/AddTodo.vue]
<script setup lang="ts">
const title = ref('')

const { status, error, mutate } = useFetchMutation('/api/todos')

async function addTodo () {
  const todo = await mutate({ body: { title: title.value } })
  if (todo) {
    title.value = ''
  }
}
</script>

<template>
  <form @submit.prevent="addTodo">
    <input v-model="title">
    <button :disabled="status === 'pending'">
      Add
    </button>
    <p v-if="error">
      {{ error.message }}
    </p>
  </form>
</template>
```

The request is sent with the `POST` method unless you set another one. The `body`, `query` and `headers` of each request are passed to `mutate`, while the options passed to `useFetchMutation` apply to every request.

::note
`useFetchMutation` is a composable meant to be called directly in a setup function, plugin, or route middleware. The `mutate` function it returns can be called from anywhere, such as an event handler.
::

::note
`mutate` resolves to the response of that request, or to `undefined` if it failed or was aborted. It never rejects: the error is available in `error`. Every call sends a request, even if an earlier one is still pending, and `data`, `status` and `error` always reflect the latest call. Read more in [`useAsyncDataMutation`](/docs/api/composables/use-async-data-mutation#calling-mutate-more-than-once).
::

### Typed Requests

The URL, the response, and the `body`, `query` and `headers` passed to `mutate` are typed from the routes your server serves, as with [`$fetch`](/docs/getting-started/data-fetching#typed-routes). The method decides which route handles the request, so `/api/todos` is typed by `server/api/todos.post.ts` unless you set another method.

For a handler that validates its body:

```ts [server/api/todos.post.ts]
import { z } from 'zod'

export default defineValidatedHandler({
  validate: { body: z.object({ title: z.string() }) },
  handler: () => ({ id: '1' }),
})
```

```ts
const { mutate } = useFetchMutation('/api/todos')

await mutate({ body: { title: 'Buy milk' } })
await mutate({ body: { title: 42 } })
//                    ^ not assignable to string
await mutate()
//    ^ body is required
```

### Setting the Method

Pass `method` to send the request with another method. The route handling that method is used for the types:

```ts [app/components/TodoItem.vue]
const props = defineProps<{ id: string }>()

const { mutate: rename } = useFetchMutation(() => `/api/todos/${props.id}`, { method: 'patch' })
const { mutate: remove } = useFetchMutation(() => `/api/todos/${props.id}`, { method: 'delete' })

await rename({ body: { title: 'Buy oat milk' } })
await remove()
```

::note
The default differs from `useFetch` and `$fetch`, which send `GET` requests. A request with a body cannot be sent with `GET`, and requests sent with `POST` are not retried by default, so a change is not accidentally made twice.
::

### Options and Payload

The `query` and `headers` passed to `useFetchMutation` are merged with the ones passed to `mutate`. When both set the same key, the value passed to `mutate` is used:

```ts
const { mutate } = useFetchMutation('/api/comments', {
  query: { locale: 'en' },
  headers: { 'x-client': 'web' },
})

// sends POST /api/comments?locale=en&notify=true
await mutate({ body: { text: 'Nice post!' }, query: { notify: 'true' } })
```

The URL and the request options can be a `ref` or a getter. They are not watched: their current values are read each time `mutate` is called, so the request always uses the latest values without sending a new request when they change.

```ts
const token = useCookie('token')

const { mutate } = useFetchMutation('/api/profile', {
  method: 'put',
  // read on each call, so the latest token is always sent
  headers: () => ({ Authorization: `Bearer ${token.value}` }),
})
```

## Type

```ts [Signature]
export function useFetchMutation<ResT = void, ErrorT = NuxtError<unknown>, DataT = ResT, DefaultT = undefined> (
  url: string | Request | Ref<string | Request> | (() => string | Request),
  options?: UseFetchMutationOptions<ResT, DataT, DefaultT>,
): AsyncDataMutation<[payload?: FetchMutationPayload, opts?: AsyncDataMutationExecuteOptions], DataT, ErrorT, DefaultT>

type UseFetchMutationOptions<ResT, DataT = ResT, DefaultT = undefined> = {
  method?: MaybeRefOrGetter<string>
  query?: MaybeRefOrGetter<SearchParams>
  headers?: MaybeRefOrGetter<Record<string, string> | [key: string, value: string][] | Headers>
  baseURL?: MaybeRefOrGetter<string>
  default?: () => DefaultT | Ref<DefaultT>
  transform?: (input: ResT) => DataT | Promise<DataT>
  deep?: boolean
  timeout?: number
  middleware?: AsyncDataMiddleware<ResT>[]
  $fetch?: typeof globalThis.$fetch
}

type FetchMutationPayload = {
  body?: RequestInit['body'] | Record<string, any>
  query?: SearchParams
  headers?: Record<string, string> | [key: string, value: string][] | Headers
}

interface AsyncDataMutationExecuteOptions {
  signal?: AbortSignal
  timeout?: number
}

type AsyncDataMutation<Args extends unknown[], DataT, ErrorT, DefaultT> = {
  data: Ref<DataT | DefaultT>
  pending: ComputedRef<boolean>
  status: Ref<AsyncDataRequestStatus>
  error: Ref<ErrorT | undefined>
  mutate: (...args: Args) => Promise<DataT | undefined>
  clear: () => void
}

type AsyncDataRequestStatus = 'idle' | 'pending' | 'success' | 'error'
```

When the route requires a body, the `payload` argument of `mutate` is required as well.

## Parameters

- `URL` (`string | Request | Ref<string | Request> | () => string | Request`): The URL or request to send. Can be a string, a Request object, a Vue ref, or a function returning a string/Request. Its current value is read on each call.

- `options` (object): Configuration for every request. Extends [unjs/ofetch](https://github.com/unjs/ofetch) options, such as `onRequest`, `onResponse` and `retry`, and [`AsyncDataMutationOptions`](/docs/api/composables/use-async-data-mutation#parameters).

| Option       | Type                                                                    | Default  | Description                                                                                                                                                                                                   |
|--------------|-------------------------------------------------------------------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `method`     | `MaybeRefOrGetter<string>`                                              | `'POST'` | HTTP request method.                                                                                                                                                                                          |
| `query`      | `MaybeRefOrGetter<SearchParams>`                                        | -        | Query/search params to append to the URL. Merged with the `query` passed to `mutate`.                                                                                                                        |
| `headers`    | `MaybeRefOrGetter<Record<string, string> \| [key, value][] \| Headers>` | -        | Request headers. Merged with the `headers` passed to `mutate`.                                                                                                                                               |
| `baseURL`    | `MaybeRefOrGetter<string>`                                              | -        | Base URL for the request.                                                                                                                                                                                     |
| `default`    | `() => DefaultT`                                                        | -        | Factory for the value of `data` before the first request resolves, and after a request fails.                                                                                                               |
| `transform`  | `(input: ResT) => DataT \| Promise<DataT>`                              | -        | Function to transform the response. `mutate` resolves to the transformed value.                                                                                                                              |
| `deep`       | `boolean`                                                               | `false`  | Return data in a deep ref object. Defaults to `false` for improved performance (shallow ref object).                                                                                                          |
| `timeout`    | `number`                                                                | -        | A number in milliseconds after which a request is aborted and reported as an error (defaults to `undefined`, which means no timeout). Can be overridden for a single call.                                    |
| `middleware` | `AsyncDataMiddleware[]`                                                 | -        | Functions wrapping the execution of the request. Each receives `next`, which runs the rest of the chain and resolves to the data, and the handler context (`{ signal }`). The first entry is the outermost wrapper. Call `next()` to continue or throw to abort. |
| `$fetch`     | `typeof globalThis.$fetch`                                              | -        | Custom $fetch implementation. See [Custom useFetch in Nuxt](/docs/guide/recipes/custom-usefetch).                                                                                                            |

`mutate` accepts the `body`, `query` and `headers` of the request as its first argument, and optionally a second argument with a `signal` and a `timeout` for that call only.

## Return Values

| Name      | Type                                                    | Description                                                                                                                                  |
|-----------|---------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| `data`    | `Ref<DataT \| DefaultT>`                                | The response of the latest successful request. Holds the `default` value before the first request resolves and after a request fails.       |
| `pending` | `ComputedRef<boolean>`                                  | `true` while the latest request is in progress.                                                                                              |
| `status`  | `Ref<'idle' \| 'pending' \| 'success' \| 'error'>`      | Status of the latest request.                                                                                                                |
| `error`   | `Ref<ErrorT \| undefined>`                              | Error object if the latest request failed.                                                                                                   |
| `mutate`  | `(payload?, opts?) => Promise<DataT \| undefined>`      | Sends the request. Resolves to the response of this request, or to `undefined` if it failed or was aborted. It never rejects.                |
| `clear`   | `() => void`                                            | Aborts every pending request, resets `data` to the value of `options.default()` (or `undefined`), `error` to `undefined` and `status` to `idle`. |

### Status Values

- `idle`: no request has been sent yet, the latest request was aborted, or `clear` was called
- `pending`: the latest request is in progress
- `success`: the latest request completed successfully
- `error`: the latest request failed

:read-more{to="/docs/getting-started/data-fetching#mutations"}
