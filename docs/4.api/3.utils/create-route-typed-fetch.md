---
title: 'createRouteTypedFetch'
description: Create a $fetch client for another API, typed from the routes that API serves.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/fetch.ts
    size: xs
---

<!-- Drafted by an AI agent (Claude Code); not yet reviewed by a human. -->

`createRouteTypedFetch` creates a [`$fetch`](/docs/api/utils/dollarfetch) client for an API your app does not serve itself - a separate backend, or a third-party service - and types it from the routes that API serves. Paths, methods, request bodies, queries and responses are all checked against that route set, the same way `$fetch` is checked against your own server routes.

## Usage

```ts [app/utils/petStore.ts]
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

export const $petStore = createRouteTypedFetch({
  baseURL: 'https://api.example.com',
  routes: {} as PetStoreRoutes,
})
```

```ts
const pets = await $petStore('/pets')
//    ^? Pet[]
const pet = await $petStore('/pets/42')
//    ^? Pet
await $petStore('/pets', { method: 'post', body: { name: 'Rex' } })

await $petStore('/pats')
//              ^ no GET route matches '/pats'
await $petStore('/pets', { method: 'put' })
//                        ^ no PUT route matches '/pets'
await $petStore('/pets', { method: 'post' })
//                        ^ body is required
```

Only the type of `routes` is read, so pass `{} as Routes`. The value is removed before the client is created, so it is never passed on to `ofetch` or `fetch`. Without the `as Routes` cast, the route set is empty and every path is rejected.

The declared paths are matched **as written**, since they are the paths the API documents. You should not prefix them with the `baseURL`. A path built at runtime resolves to `unknown`, and naming the response type yourself (`$petStore<Pet>(url)`) still works.

::note
The routes a client declares are its own. They are not added to your app's route set, so plain `$fetch` and `useFetch` are unaffected, and this client does not accept your own server's paths.
::

## Type

```ts [Signature]
function createRouteTypedFetch<Routes> (
  options: FetchOptions & { routes: Routes },
): RouteTypedFetch<Routes>
```

`options` accepts everything [`$fetch.create()`](https://github.com/unjs/ofetch#%EF%B8%8F-create-fetch-with-default-options) does, such as `baseURL`, `headers`, `retry` and `onRequest`.

The returned client has the same shape as `$fetch`: it can be called directly, it has `.raw()` for the full response, and `.create()` derives a client with additional defaults that keeps the same route set.

## Using the Client with `useFetch`

Pass the client to [`createUseFetch`](/docs/api/composables/create-use-fetch) as `$fetch`. The composable it returns resolves against the client's route set, so you do not need to declare `routes` a second time:

```ts [app/composables/usePetStore.ts]
export const usePetStore = createUseFetch({ $fetch: $petStore })
```

```vue [app/pages/pets.vue]
<script setup lang="ts">
const { data: pets } = await usePetStore('/pets')
//      ^? Ref<Pet[] | undefined>
</script>
```

The route set can only be read from `$fetch` when `createUseFetch` is given a plain object. See [Typing a Third-Party API](/docs/api/composables/create-use-fetch#typing-a-third-party-api) for how to add behavior that needs the Nuxt context.

::tip
The route interface is the shape [`fetchdts`](https://github.com/unjs/fetchdts) uses, which is what Nuxt generates for your own server routes. A module can therefore generate one from an API description - an OpenAPI document, for example - with `compileRoutes` from `fetchdts/compiler`, and hand the emitted interface to `routes`.
::

:read-more{to="/docs/api/composables/create-use-fetch"}

:read-more{to="/docs/api/utils/dollarfetch"}
