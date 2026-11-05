---
title: 'createUseFetchMutation'
description: A factory function to create a custom useFetchMutation composable with pre-defined default options.
minimalVersion: "4.7"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/fetchMutation.ts
    size: xs
---

`createUseFetchMutation` creates a custom [`useFetchMutation`](/docs/api/composables/use-fetch-mutation) composable with pre-defined options. The resulting composable is fully typed and works exactly like `useFetchMutation`, but with your defaults baked in.

::note
Unlike [`createUseFetch`](/docs/api/composables/create-use-fetch), this is not a compiler macro. Mutations are not keyed, so the composable can be created anywhere, though the `composables/` directory makes it auto-imported.
::

## Usage

```ts [app/composables/useApiMutation.ts]
export const useApiMutation = createUseFetchMutation({
  baseURL: '/api',
})
```

```vue [app/components/AddTodo.vue]
<script setup lang="ts">
// sends the request to /api/todos
const { status, mutate } = useApiMutation('/todos')
</script>
```

The resulting `useApiMutation` composable has the same signature and return type as [`useFetchMutation`](/docs/api/composables/use-fetch-mutation), with all options available for the caller to use or override.

A `baseURL` set on the factory is part of the route being requested, so in the example above `/todos` is typed by the route serving `/api/todos`. A `transform` or `default` set on the factory is reflected in the type of `data`.

## Type

```ts [Signature]
function createUseFetchMutation (
  options?: Partial<UseFetchMutationOptions> & { addons?: UseFetchMutationAddon[] },
): typeof useFetchMutation

function createUseFetchMutation (
  options: (callerOptions: UseFetchMutationOptions) => Partial<UseFetchMutationOptions>,
): typeof useFetchMutation
```

The returned composable's signature includes any custom options and return-value extensions contributed by the [addons](#addons).

## Options

`createUseFetchMutation` accepts all the same options as [`useFetchMutation`](/docs/api/composables/use-fetch-mutation#parameters), including `baseURL`, `method`, `headers`, `query`, `onRequest`, `onResponse`, `transform` and `timeout`.

## Default vs Override Mode

### Default Mode (plain object)

When you pass a plain object, the factory options act as **defaults**. Callers can override any option:

```ts [app/composables/useApiMutation.ts]
export const useApiMutation = createUseFetchMutation({
  baseURL: '/api',
  timeout: 10_000,
})
```

```ts
// Uses the default timeout
const { mutate } = useApiMutation('/todos')

// Caller overrides the timeout
const { mutate } = useApiMutation('/uploads', { timeout: 60_000 })
```

### Override Mode (function)

When you pass a function, the factory options **override** the caller's options. The function receives the caller's options as its argument, so you can read them to compute your overrides:

```ts [app/composables/useApiMutation.ts]
// baseURL is always enforced, regardless of what the caller passes
export const useApiMutation = createUseFetchMutation(callerOptions => ({
  baseURL: '/api',
}))
```

The function is called each time the composable is called, so you can use composables such as [`useNuxtApp`](/docs/api/composables/use-nuxt-app) inside it, for example to pass a custom `$fetch` instance:

```ts [app/composables/useApiMutation.ts]
export const useApiMutation = createUseFetchMutation(callerOptions => ({
  $fetch: useNuxtApp().$api as typeof $fetch,
}))
```

In both modes, an option set to `undefined` is ignored rather than overriding the other side.

## Addons

In addition to `useFetchMutation` options, `createUseFetchMutation` accepts an `addons` array. Addons are reusable units of behavior defined with [`defineUseFetchMutationAddon`](/docs/api/utils/define-use-fetch-mutation-addon). They can declare custom call-site options, run middleware and fetch interceptors around the request, extend the returned object, and attach custom logic to the composable.

For example, an addon that sends an authorization header unless the caller opts out with a custom `auth` option:

```ts [app/composables/useApiMutation.ts]
const auth = defineUseFetchMutationAddon({
  // augment the call-site options for the custom useFetchMutation instance 👇
  setup: (options: UseFetchMutationAddonOptions<{ auth?: boolean }>) => {
    const token = useCookie('token')
    options.onRequest.push(({ options: fetchOptions }) => {
      if (options.auth === false) { return }
      fetchOptions.headers.set('Authorization', `Bearer ${token.value}`)
    })
  },
})

export const useApiMutation = createUseFetchMutation({ baseURL: '/api', addons: [auth] })
```

```vue [app/components/NewsletterForm.vue]
<script setup lang="ts">
// `auth` is typed on the created composable
const { mutate } = useApiMutation('/newsletter', { auth: false })
</script>
```

:read-more{to="/docs/api/utils/define-use-fetch-mutation-addon"}

:read-more{to="/docs/api/composables/use-fetch-mutation"}
