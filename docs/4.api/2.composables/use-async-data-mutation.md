---
title: 'useAsyncDataMutation'
description: Run an asynchronous function on demand, such as one that saves or deletes data, and track its result.
minimalVersion: "4.7"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/asyncDataMutation.ts
    size: xs
---

`useAsyncDataMutation` wraps an asynchronous function that changes something, such as saving a form, creating a record or deleting a file. The function only runs when you call `mutate`, and the result, status and error of the call are tracked in reactive refs, so you can show a loading state or an error message without managing them yourself.

Unlike [`useAsyncData`](/docs/api/composables/use-async-data), it never runs on its own. Its state is local to the component that called it: it is not keyed, not shared with other components and not transferred from the server to the client in the payload.

::tip{to="/docs/api/composables/use-fetch-mutation"}
Sending a request to an API endpoint? `useFetchMutation` sends it for you, with the request body, query and headers typed from your server routes.
::

## Usage

```vue [app/components/NewsletterForm.vue]
<script setup lang="ts">
const email = ref('')

const { status, error, mutate } = useAsyncDataMutation(
  (address: string, { signal }) => $fetch('/api/newsletter', { method: 'POST', body: { address }, signal }),
)
</script>

<template>
  <form @submit.prevent="mutate(email)">
    <input
      v-model="email"
      type="email"
    >
    <button :disabled="status === 'pending'">
      Subscribe
    </button>
    <p v-if="status === 'success'">
      Thanks for subscribing!
    </p>
    <p v-if="error">
      {{ error.message }}
    </p>
  </form>
</template>
```

The handler receives the input passed to `mutate` as its first argument, and the type of that input is inferred from the handler. A handler that takes no input is run with `mutate()`.

::note
`useAsyncDataMutation` is a composable meant to be called directly in a setup function, plugin, or route middleware. The `mutate` function it returns can be called from anywhere, such as an event handler.
::

::note
`data`, `status`, `pending` and `error` are Vue refs. `mutate` and `clear` are plain functions. Unlike `useAsyncData`, the returned object is not a promise, so there is nothing to `await` when calling the composable itself.
::

### Using the Result of a Call

`mutate` resolves to the data of that call, so you can use the result directly, for example to update other state:

```ts [app/components/TodoList.vue]
const todos = ref<Todo[]>([])

const { mutate } = useAsyncDataMutation(
  (title: string, { signal }) => $fetch<Todo>('/api/todos', { method: 'POST', body: { title }, signal }),
)

async function addTodo (title: string) {
  const todo = await mutate(title)
  if (todo) {
    todos.value.push(todo)
  }
}
```

Like `execute` in `useAsyncData`, `mutate` never rejects. If the call fails or is aborted, it resolves to `undefined` and the error is available in `error`.

### Calling `mutate` More Than Once

Every call to `mutate` runs, even if an earlier call is still pending. Each call resolves to its own result, while `data`, `status` and `error` always reflect the latest call: if an earlier call finishes after a later one, it does not overwrite the state.

To stop a form from being submitted twice, disable the button that triggers it while `status` is `'pending'`, as in the example above.

### Aborting a Call

The handler receives an `AbortSignal` in its second argument. Pass it on to the request, as with `$fetch` above, so that the request can be aborted.

The signal is aborted when:

- `clear` is called
- the component that called `useAsyncDataMutation` is unmounted
- the `timeout` is exceeded
- a `signal` passed to `mutate` is aborted

```ts [app/components/FileUpload.vue]
const { mutate } = useAsyncDataMutation((file: File, { signal }) => {
  const body = new FormData()
  body.append('file', file)
  return $fetch('/api/upload', { method: 'POST', body, signal })
})

let abortController: AbortController | undefined

function handleUpload (file: File) {
  abortController = new AbortController()
  mutate(file, { signal: abortController.signal })
}

function handleCancel () {
  abortController?.abort() // aborts the ongoing upload
}
```

An aborted call resolves to `undefined`. If it was the latest call, `status` goes back to `'idle'`. A call that exceeds its `timeout` is reported as an error instead.

::warning
Aborting a call stops waiting for it, but it cannot undo a change the server has already made. If the request reached the server before it was aborted, the change may still have been applied.
::

## Type

```ts [Signature]
export function useAsyncDataMutation<ResT, InputT = void, ErrorDataT = unknown, DataT = ResT, DefaultT = undefined> (
  handler: AsyncDataMutationHandler<InputT, ResT>,
  options?: AsyncDataMutationOptions<ResT, DataT, DefaultT>,
): AsyncDataMutation<[input: InputT, opts?: AsyncDataMutationExecuteOptions], DataT, NuxtError<ErrorDataT>, DefaultT>

type AsyncDataMutationHandler<InputT, ResT> = (input: InputT, ctx: { signal: AbortSignal }) => Promise<ResT>

type AsyncDataMutationOptions<ResT, DataT = ResT, DefaultT = undefined> = {
  default?: () => DefaultT | Ref<DefaultT>
  transform?: (input: ResT) => DataT | Promise<DataT>
  deep?: boolean
  timeout?: number
  middleware?: AsyncDataMiddleware<ResT>[]
}

type AsyncDataMiddleware<ResT> = (next: () => Promise<ResT>, ctx: { signal: AbortSignal }) => Promise<ResT>

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

## Parameters

- `handler`: an asynchronous function that receives the input passed to `mutate` and a context object with an abort `signal`. It runs within the Nuxt context, so you can use composables such as [`useRuntimeConfig`](/docs/api/composables/use-runtime-config) inside it.
- `options` (object): configuration for the mutation. Options are plain values and are not watched.

| Option       | Type                                        | Default | Description                                                                                                                                                                                                   |
|--------------|---------------------------------------------|---------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `default`    | `() => DefaultT`                            | -       | Factory for the value of `data` before the first call resolves, and after a call fails.                                                                                                                      |
| `transform`  | `(input: ResT) => DataT \| Promise<DataT>`  | -       | Function to transform the result of the handler. `mutate` resolves to the transformed value.                                                                                                                |
| `deep`       | `boolean`                                   | `false` | Return data in a deep ref object. Defaults to `false` for improved performance (shallow ref object).                                                                                                          |
| `timeout`    | `number`                                    | -       | A number in milliseconds after which a call is aborted and reported as an error (defaults to `undefined`, which means no timeout). Can be overridden for a single call.                                      |
| `middleware` | `AsyncDataMiddleware[]`                     | -       | Functions wrapping the execution of the handler. Each receives `next`, which runs the rest of the chain and resolves to the data, and the handler context (`{ signal }`). The first entry is the outermost wrapper. Call `next()` to continue or throw to abort. |

`mutate` accepts the input as its first argument, and optionally a second argument with a `signal` and a `timeout` for that call only.

## Return Values

| Name      | Type                                                    | Description                                                                                                                                  |
|-----------|---------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| `data`    | `Ref<DataT \| DefaultT>`                                | The result of the latest successful call. Holds the `default` value before the first call resolves and after a call fails.                  |
| `pending` | `ComputedRef<boolean>`                                  | `true` while the latest call is in progress.                                                                                                 |
| `status`  | `Ref<'idle' \| 'pending' \| 'success' \| 'error'>`      | Status of the latest call.                                                                                                                   |
| `error`   | `Ref<ErrorT \| undefined>`                              | Error object if the latest call failed.                                                                                                      |
| `mutate`  | `(input, opts?) => Promise<DataT \| undefined>`         | Runs the handler. Resolves to the data of this call, or to `undefined` if it failed or was aborted. It never rejects.                        |
| `clear`   | `() => void`                                            | Aborts every pending call, resets `data` to the value of `options.default()` (or `undefined`), `error` to `undefined` and `status` to `idle`. |

### Status Values

- `idle`: no call has been made yet, the latest call was aborted, or `clear` was called
- `pending`: the latest call is in progress
- `success`: the latest call resolved
- `error`: the latest call failed

:read-more{to="/docs/getting-started/data-fetching#mutations"}
