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

function createUseFetch<Routes> (
  options: Partial<UseFetchOptions> & { routes: Routes, addons?: UseFetchAddon[] },
): DeclaredUseFetch<Routes>
```

The returned composable's signature includes any custom options and return-value extensions contributed by the [addons](#addons).

## Options

`createUseFetch` accepts all the same options as [`useFetch`](/docs/api/composables/use-fetch#parameters), including `baseURL`, `headers`, `query`, `onRequest`, `onResponse`, `server`, `lazy`, `transform`, `getCachedData`, and more.

See the full list of options in the [`useFetch` documentation](/docs/api/composables/use-fetch#parameters).

## Typing a Third-Party API

From Nuxt 4.6, pass `routes` to describe the API a composable calls. Its responses, query parameters,
and request bodies are typed from that route set, including when `experimental.routeTypedFetch` is off:

```ts [app/composables/usePetStore.ts]
import type { DynamicParam, Endpoint } from 'nuxt/app'

interface Pet { id: number, name: string }

interface PetStoreRoutes {
  '/pets': {
    [Endpoint]: {
      GET: { response: Pet[], query: { limit?: number } }
      POST: { response: Pet, body: { name: string } }
    }
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

```vue [app/pages/pets.vue]
<script setup lang="ts">
const { data: pets } = await usePetStore('/pets', { query: { limit: 10 } })
const { data: pet } = await usePetStore('/pets/42')
await usePetStore('/pets', { method: 'post', body: { name: 'Rex' } })
</script>
```

`pets.value` is typed as `Pet[] | undefined`, and `pet.value` as `Pet | undefined`. The `POST`
request requires a body with a `name` string.

Only the type of `routes` is read, so pass `{} as Routes`; the value is dropped before the request is
made. The declared paths are matched **as written**. Do not prefix them with the `baseURL`.
A path built at runtime resolves to `unknown`.

Unmatched paths and methods are accepted by default and resolve to `unknown`. To reject them, enable
[`routeTypedFetch`](/docs/guide/going-further/experimental-features#routetypedfetch) and
[`strictRouteTypes`](/docs/guide/going-further/experimental-features#strictroutetypes):

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  experimental: {
    routeTypedFetch: true,
    strictRouteTypes: true,
  },
})
```

With these options enabled, `usePetStore('/pats')` and
`usePetStore('/pets', { method: 'put' })` are type errors.

::note
The routes a client declares are its own. They are not added to your app's route set, so plain
`$fetch` and `useFetch` are unaffected. This client types requests against its declared routes,
not your own server's routes.
::

::tip
The interface above is the shape [`fetchdts`](https://github.com/unjs/fetchdts) uses. A module can
generate one from an API description, such as an OpenAPI document, with `compileRoutes` from
`fetchdts/compiler`, and pass the emitted interface to `routes`.
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
