---
title: 'createUseFetch'
description: A factory function to create a custom useFetch composable with pre-defined default options.
minimalVersion: "4.4"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/fetch.ts
    size: xs
---

`createUseFetch` creates a custom [`useFetch`](/docs/api/composables/use-fetch) composable with pre-defined options. The resulting composable is fully typed and works exactly like `useFetch`, but with your defaults baked in.

::note
`createUseFetch` is a compiler macro. It must be used as an **exported** declaration in the `composables/` directory (or any directory scanned by the Nuxt compiler). Nuxt automatically injects de-duplication keys at build time.
::

## Usage

```ts [app/composables/useAPI.ts]
export const useAPI = createUseFetch({
  baseURL: 'https://api.nuxt.com',
})
```

```vue [app/pages/modules.vue]
<script setup lang="ts">
const { data: modules } = await useAPI('/modules')
</script>
```

The resulting `useAPI` composable has the same signature and return type as [`useFetch`](/docs/api/composables/use-fetch), with all options available for the caller to use or override.

## Type

```ts [Signature]
function createUseFetch (
  options?: Partial<UseFetchOptions> & { addons?: UseFetchAddon[] },
): typeof useFetch

function createUseFetch (
  options: (callerOptions: UseFetchOptions) => Partial<UseFetchOptions>,
): typeof useFetch

// where the client declares the routes it serves
function createUseFetch<Routes> (
  options: Partial<UseFetchOptions> & { routes: Routes, addons?: UseFetchAddon[] },
): DeclaredUseFetch<Routes>

// where the routes are read off a client created with `createRouteTypedFetch`
function createUseFetch<Routes> (
  options: Partial<Omit<UseFetchOptions, '$fetch'>> & { $fetch: RouteTypedFetch<Routes>, addons?: UseFetchAddon[] },
): DeclaredUseFetch<Routes>
```

The returned composable's signature includes any custom options and return-value extensions contributed by the [addons](#addons).

## Options

`createUseFetch` accepts all the same options as [`useFetch`](/docs/api/composables/use-fetch#parameters), including `baseURL`, `headers`, `query`, `onRequest`, `onResponse`, `server`, `lazy`, `transform`, `getCachedData`, and more.

See the full list of options in the [`useFetch` documentation](/docs/api/composables/use-fetch#parameters).

## Typing a Third-Party API

By default a composable created with `createUseFetch` is typed from the routes your own server
serves, so a request to another API resolves to `unknown`. Pass `routes` to say what that API serves,
and every request the composable makes is resolved against it instead:

```ts [app/composables/usePetStore.ts]
import type { DynamicParam, Endpoint } from 'nuxt/app'

interface Pet { id: number, name: string }

interface PetStoreRoutes {
  '/pets': {
    [Endpoint]: {
      GET: { response: Pet[], query: { limit?: number } }
      POST: { response: Pet, body: { name: string } }
    }
    // a path parameter, matched positionally
    [DynamicParam]: {
      [Endpoint]: { GET: { response: Pet } }
    }
  }
}

export const usePetStore = createUseFetch({
  baseURL: 'https://api.example.com',
  routes: {} as PetStoreRoutes,
})
```

```ts
const { data: pets } = await usePetStore('/pets')
//      ^? Pet[]
const { data: pet } = await usePetStore('/pets/42')
//      ^? Pet
await usePetStore('/pets', { method: 'post', body: { name: 'Rex' } })

await usePetStore('/pats')
//                ^ no GET route matches '/pats'
await usePetStore('/pets', { method: 'put' })
//                          ^ no PUT route matches '/pets'
await usePetStore('/pets', { method: 'post' })
//                          ^ body is required
```

Only the type of `routes` is read, so pass `{} as Routes`; the value is dropped before the request is
made. The declared paths are matched **as written**, since they are the paths the API documents. You
should not prefix them with the `baseURL`. A path built at runtime resolves to `unknown`.

::note
The routes a client declares are its own. They are not added to your app's route set, so plain
`$fetch` and `useFetch` are unaffected, and this client will not accept your own server's paths.
::

::tip
The interface above is the shape [`fetchdts`](https://github.com/unjs/fetchdts) uses, which is what
Nuxt generates for your own server routes. A module can therefore generate one from an API
description - an OpenAPI document, for example - with `compileRoutes` from `fetchdts/compiler`, and
hand the emitted interface to `routes`.
::

<!-- Drafted by an AI agent (Claude Code); not yet reviewed by a human. -->

### Sharing the Route Set with `$fetch`

If you also call the API outside of `useFetch`, create the client with
[`createRouteTypedFetch`](/docs/api/utils/create-route-typed-fetch) and pass it as `$fetch`. The
composable reads the route set from the client, so it is declared once:

```ts [app/utils/petStore.ts]
export const $petStore = createRouteTypedFetch({
  baseURL: 'https://api.example.com',
  routes: {} as PetStoreRoutes,
})
```

```ts [app/composables/usePetStore.ts]
export const usePetStore = createUseFetch({ $fetch: $petStore })
```

`await $petStore('/pets')` and `await usePetStore('/pets')` are then checked against the same routes.

::important
The route set is only read from `$fetch` when `createUseFetch` is given a **plain object**. In
[override mode](#override-mode-function) the factory is a function, so its result is only known per
call and the composable is typed from your own server's routes again.

Behavior that needs the Nuxt context at the call site - such as reading a token with
[`useCookie`](/docs/api/composables/use-cookie) - therefore belongs in an [addon](#addons) rather
than in an override function. Addons run in the setup context of every call:

```ts [app/composables/usePetStore.ts]
const auth = defineUseFetchAddon({
  setup: (options) => {
    const token = useCookie('token')
    options.onRequest.push(({ options }) => {
      if (token.value) {
        options.headers.set('authorization', `Bearer ${token.value}`)
      }
    })
  },
})

export const usePetStore = createUseFetch({ $fetch: $petStore, addons: [auth] })
```
::

## Default vs Override Mode

### Default Mode (plain object)

When you pass a plain object, the factory options act as **defaults**. Callers can override any option:

```ts [app/composables/useAPI.ts]
export const useAPI = createUseFetch({
  baseURL: 'https://api.nuxt.com',
  lazy: true,
})
```

```ts
// Uses the default baseURL
const { data } = await useAPI('/modules')

// Caller overrides the baseURL
const { data } = await useAPI('/modules', { baseURL: 'https://other-api.com' })
```

### Override Mode (function)

When you pass a function, the factory options **override** the caller's options. The function receives the caller's options as its argument, so you can read them to compute your overrides:

```ts [app/composables/useAPI.ts]
// baseURL is always enforced, regardless of what the caller passes
export const useAPI = createUseFetch(callerOptions => ({
  baseURL: 'https://api.nuxt.com',
}))
```

This is useful for enforcing settings like authentication headers or a specific base URL that should not be changed by the caller.

## Combining with a Custom `$fetch`

You can pass a custom `$fetch` instance to `createUseFetch`:

```ts [app/composables/useAPI.ts]
export const useAPI = createUseFetch(callerOptions => ({
  $fetch: useNuxtApp().$api as typeof $fetch,
  ...callerOptions,
}))
```

::important
The **function signature** (override mode) is required here so that [`useNuxtApp()`](/docs/api/composables/use-nuxt-app) is called in the setup context (at the composable call site) rather than in the module scope, where no Nuxt instance is available.
::

::tip
A client for another API that you create with [`createRouteTypedFetch`](/docs/api/utils/create-route-typed-fetch) does not need the Nuxt instance, so it can be passed in a plain object instead. That also keeps its route types. See [Sharing the Route Set with `$fetch`](#sharing-the-route-set-with-fetch).
::

## Addons

In addition to `useFetch` options, `createUseFetch` accepts an `addons` array. Addons are reusable units of behavior defined with [`defineUseFetchAddon`](/docs/api/utils/define-use-fetch-addon). They can declare custom call-site options, run middleware around the handler, extend the returned object, and attach custom logic to the composable.

For example, an addon that refreshes the data whenever the window regains focus, gated behind a custom `refreshOnFocus` option, so callers opt in per call:

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
// `refreshOnFocus` is typed on the created composable
const { data } = await useCustomFetch(
  'https://api.nuxtjs.dev/mountains',
  { refreshOnFocus: true },
)
</script>
```

:read-more{to="/docs/api/utils/define-use-fetch-addon"}

:read-more{to="/docs/guide/recipes/custom-usefetch"}

:read-more{to="/docs/api/composables/use-fetch"}
