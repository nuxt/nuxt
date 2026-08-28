---
title: 'defineUseFetchAddon'
description: Define a reusable addon that extends composables created with createUseFetch.
minimalVersion: "4.6"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/addons.ts
    size: xs
---

`defineUseFetchAddon` defines a reusable extension for `useFetch` composables created with [`createUseFetch`](/docs/4.x/api/composables/create-use-fetch).

An addon can declare custom call-site options, wrap the handler with middleware, attach custom reactive logic or extend the returned object.

## Usage

Pass addons to `createUseFetch` via the `addons` array.

This addon attaches custom logic: a watcher that refreshes the data whenever the window regains focus and gates it behind a custom `refreshOnFocus` option:

```ts [app/composables/useCustomFetch.ts]
const refreshOnFocus = defineUseFetchAddon({
  // augment the call-site options for the custom useFetch instance 👇
  setup: (options: UseFetchAddonOptions<{ refreshOnFocus?: boolean }>) => {
    // 👈 run code *before* calling `useAsyncData` in `useFetch`
    if (import.meta.server || !options.refreshOnFocus) { return }

    return (asyncData) => {
      // 👈 run code *after* calling `useAsyncData` in `useFetch`
      const focused = useWindowFocus()
      watch(focused, (focused) => {
        if (focused) { asyncData.refresh() }
      })

      return { focused } // 👈 extend the returned object with a new property
    }
  },
})

export const useCustomFetch = createUseFetch({ addons: [refreshOnFocus] })
```

```vue [app/pages/index.vue]
<script setup lang="ts">
const { data } = await useCustomFetch('/some-endpoint', { refreshOnFocus: true })
</script>
```

The addon's `setup` function runs on every call of the composable, and receives the merged options (factory defaults plus caller options).

::note
Addons run in the order of the `addons` array, with middleware from the first addon as the outermost wrapper. Listing the same addon object more than once runs it only once.
::

## Custom Options

Declare custom options by annotating the `setup` `options` parameter with `UseFetchAddonOptions<{ ... }>`. The options become part of the created composable's signature, fully typed for callers:

```ts [app/composables/useCustomFetch.ts]
const auth = defineUseFetchAddon({
  setup: (options: UseFetchAddonOptions<{ auth?: MaybeRefOrGetter<boolean> }>) => {
    const { token } = useTokenStore()
    options.auth ??= true
    options.onRequest.push(({ options: fetchOptions }) => {
      if (!toValue(options.auth)) { return }
      fetchOptions.headers.set('Authorization', `Bearer ${token.value}`)
    })
  },
})

export const useCustomFetch = createUseFetch({ addons: [auth] })
```

```vue [app/pages/index.vue]
<script setup lang="ts">
// `auth` is typed
const { data } = await useCustomFetch('/public-endpoint', { auth: false })
</script>
```

## Extending the Return Value

If `setup` returns a function, that function is called with the async data instance. Any object it returns is merged into the composable's return value:

```ts
const timestamps = defineUseFetchAddon({
  setup: () => {
    const refreshedAt = ref<Date>()

    return (asyncData) => {
      watch(asyncData.status, (status) => {
        if (status === 'success') { refreshedAt.value = new Date() }
      }, { immediate: true })

      return { refreshedAt: readonly(refreshedAt) }
    }
  },
})

export const useCustomFetch = createUseFetch({ addons: [timestamps] })
```

```vue [app/pages/index.vue]
<script setup lang="ts">
// `refreshedAt` is typed
const { data, refreshedAt } = await useCustomFetch('/modules')
</script>
```

## Middleware

Middleware wraps the execution of the request handler. Call `next()` to continue the chain (and get the resolved data), or throw to abort. Middleware from the first addon is the outermost wrapper:

```ts
const minDuration = defineUseFetchAddon({
  setup: (options: UseFetchAddonOptions<{ minDuration?: number }>) => {
    options.middleware.push(async (next) => {
      const [result] = await Promise.all([
        next(),
        new Promise(resolve => setTimeout(resolve, toValue(options.minDuration) ?? 300)),
      ])
      return result
    })
  },
})
```

## Contributing to the Auto-Generated Key

Custom options are **not** part of the auto-generated key by default. If a custom option affects the response, provide a `key` resolver so calls with different values do not share a cached entry. Return a serializable value, or `undefined` to contribute nothing:

```ts
const scoped = defineUseFetchAddon({
  key: options => toValue(options.scope),
  setup: (options: UseFetchAddonOptions<{ scope?: string }>) => {
    options.scope ??= 'default'
    // ...
  },
})
```

## Wrapping `then`, `catch` and `finally`

As an advanced escape hatch, the extension object may include `then`, `catch` or `finally` functions. These are not merged into the instance. Instead they wrap the corresponding method of the awaitable promise, receiving the original method as their first argument.

::note
When several addons wrap the same method, the wrappers are composed in the order of the `addons` array: the first addon's wrapper wraps all the following ones, just as its middleware would.
::

## Type

```ts [Signature]
function defineUseFetchAddon<Opts extends Record<string, any> = {}, Ext = {}> (addon: {
  key?: (options: UseFetchAddonOptions<Opts>) => SerializableValue
  setup: (options: UseFetchAddonOptions<Opts>) => ((asyncData: AsyncDataAddonInstance) => Ext | void) | void
}): UseFetchAddon<Opts, Ext>
```

::note
`middleware`, `onRequest`, `onRequestError`, `onResponse` and `onResponseError` are always normalized to arrays, so interceptors from the caller and from other addons are preserved.
::
