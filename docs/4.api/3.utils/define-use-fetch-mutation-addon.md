---
title: 'defineUseFetchMutationAddon'
description: Define a reusable addon that extends composables created with createUseFetchMutation.
minimalVersion: "4.7"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/addons.ts
    size: xs
---

`defineUseFetchMutationAddon` defines a reusable extension for `useFetchMutation` composables created with [`createUseFetchMutation`](/docs/api/composables/create-use-fetch-mutation).

An addon can declare custom call-site options, wrap the request with middleware or fetch interceptors, attach custom reactive logic or extend the returned object.

:read-more{to="/docs/api/utils/define-use-fetch-addon" title="defineUseFetchAddon: Mutation addons work like useFetch addons"}

## Usage

Pass addons to `createUseFetchMutation` via the `addons` array.

This addon asks the user to confirm before the request is sent, gated behind a custom `confirm` option:

```ts [app/composables/useConfirmedMutation.ts]
const confirmable = defineUseFetchMutationAddon({
  // augment the call-site options for the custom useFetchMutation instance 👇
  setup: (options: UseFetchMutationAddonOptions<{ confirm?: string }>) => {
    if (!options.confirm) { return }
    options.middleware.push((next) => {
      if (!window.confirm(options.confirm)) {
        // an `AbortError` sets `status` back to `idle` rather than reporting an error
        throw new DOMException('Cancelled by the user', 'AbortError')
      }
      return next()
    })
  },
})

export const useConfirmedMutation = createUseFetchMutation({ addons: [confirmable] })
```

```vue [app/components/TodoItem.vue]
<script setup lang="ts">
const props = defineProps<{ id: string }>()

const { mutate: remove } = useConfirmedMutation(() => `/api/todos/${props.id}`, {
  method: 'delete',
  confirm: 'Delete this todo?',
})
</script>
```

The addon's `setup` function runs on every call of the composable, and receives the merged options (factory defaults plus caller options).

::note
Addons run in the order of the `addons` array, with middleware from the first addon as the outermost wrapper. Listing the same addon object more than once runs it only once.
::

## Custom Options

Declare custom options by annotating the `setup` `options` parameter with `UseFetchMutationAddonOptions<{ ... }>`. The options become part of the created composable's signature, fully typed for callers.

Custom options stay in the merged options object, so they are also passed to `$fetch` along with the request options, and `$fetch` ignores keys it does not recognize.

## Fetch Interceptors

`onRequest`, `onRequestError`, `onResponse` and `onResponseError` are always normalized to arrays, so an addon can push its own interceptors while those from the caller and from other addons are preserved:

```ts
const auth = defineUseFetchMutationAddon({
  setup: (options: UseFetchMutationAddonOptions<{ auth?: boolean }>) => {
    const token = useCookie('token')
    options.onRequest.push(({ options: fetchOptions }) => {
      if (options.auth === false) { return }
      fetchOptions.headers.set('Authorization', `Bearer ${token.value}`)
    })
  },
})
```

The interceptors run for every request the composable sends.

## Extending the Return Value

If `setup` returns a function, that function is called with the mutation instance. Any object it returns is merged into the composable's return value:

```ts
const succeededAt = defineUseFetchMutationAddon({
  setup: () => (mutation) => {
    const at = ref<Date>()
    watch(mutation.status, (status) => {
      if (status === 'success') { at.value = new Date() }
    })
    return { succeededAt: readonly(at) }
  },
})

export const useTrackedMutation = createUseFetchMutation({ addons: [succeededAt] })
```

```vue [app/components/ProfileForm.vue]
<script setup lang="ts">
// `succeededAt` is typed
const { mutate, succeededAt } = useTrackedMutation('/api/profile', { method: 'put' })
</script>
```

::note
A mutation is not awaitable, so `then`, `catch` and `finally` returned in the extension object are not merged into it. Unlike [`useFetch` addons](/docs/api/utils/define-use-fetch-addon#wrapping-then-catch-and-finally), mutation addons cannot wrap them.
::

## Middleware

Middleware wraps the execution of each request. Call `next()` to continue the chain (and get the resolved data), or throw to abort. Middleware from the first addon is the outermost wrapper:

```ts
const minDuration = defineUseFetchMutationAddon({
  setup: (options: UseFetchMutationAddonOptions<{ minDuration?: number }>) => {
    options.middleware.push(async (next) => {
      const [result] = await Promise.all([
        next(),
        new Promise(resolve => setTimeout(resolve, options.minDuration ?? 300)),
      ])
      return result
    })
  },
})
```

## Type

```ts [Signature]
function defineUseFetchMutationAddon<Opts extends Record<string, any> = {}, Ext = {}> (addon: {
  setup: (options: UseFetchMutationAddonOptions<Opts>) => ((mutation: AsyncDataMutationAddonInstance) => Ext | void) | void
}): UseFetchMutationAddon<Opts, Ext>
```

::note
Mutations are not keyed, so unlike [`defineUseFetchAddon`](/docs/api/utils/define-use-fetch-addon), mutation addons do not accept a `key` resolver.
::
