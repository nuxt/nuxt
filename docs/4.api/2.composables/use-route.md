---
title: "useRoute"
description: The useRoute composable returns the current route.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/router.ts
    size: xs
---

::note
Within the template of a Vue component, you can access the route using `$route`.
::

The `useRoute` composable is a wrapper around the identically named composable from `vue-router`, providing access to the current route in a Nuxt application.

The key difference is that in Nuxt, the composable ensures that the route is updated **only after** the page content has changed after navigation.
In contrast, the `vue-router` version updates the route **immediately**, which can lead to synchronization issues between different parts of the template
that rely on the route metadata, for example.

## Example

In the following example, we call an API via [`useFetch`](/docs/4.x/api/composables/use-fetch) using a dynamic page parameter - `slug` - as part of the URL.

```html [~/pages/[slug\\].vue]
<script setup lang="ts">
const route = useRoute()
const { data: mountain } = await useFetch(`/api/mountains/${route.params.slug}`)
</script>

<template>
  <div>
    <h1>{{ mountain.title }}</h1>
    <p>{{ mountain.description }}</p>
  </div>
</template>
```

If you need to access the route query parameters (for example `example` in the path `/test?example=true`), then you can use `useRoute().query` instead of `useRoute().params`.

## API

Apart from dynamic parameters and query parameters, `useRoute()` also provides the following computed references related to the current route:

- `fullPath`: encoded URL associated with the current route that contains path, query and hash
- `hash`: decoded hash section of the URL that starts with a #
- `query`: access route query parameters
- `matched`: array of normalized matched routes with current route location
- `meta`: custom data attached to the record
- `name`: unique name for the route record
- `path`: encoded pathname section of the URL
- `redirectedFrom`: route location that was attempted to access before ending up on the current route location

## Common Pitfalls

### Route Synchronization Issues

It’s important to use the `useRoute()` composable from Nuxt rather than the one from `vue-router` to avoid synchronization issues during page navigation.
Importing `useRoute` directly from `vue-router` bypasses Nuxt's implementation.

```ts twoslash
// ❌ do not use `useRoute` from `vue-router`
// @errors: 2300
import { useRoute } from 'vue-router'
// ✅ use Nuxt's `useRoute` composable
import { useRoute } from '#app'
```

### Calling `useRoute` in Middleware

Using `useRoute` in middleware is not recommended because it can lead to unexpected behavior.
There is no concept of a "current route" in middleware.
The `useRoute()` composable should only be used in the setup function of a Vue component or in a Nuxt plugin.

::warning
This applies to any composable that uses `useRoute()` internally too.
::

::read-more{to="/docs/4.x/directory-structure/app/middleware"}
Read more about accessing the route in the middleware section.
::

### Hydration Issues with `route.fullPath`

Browsers don't send [URL fragments](https://url.spec.whatwg.org/#concept-url-fragment) (for example `#foo`) when making requests. So using `route.fullPath` to affect the template can trigger hydration issues because this will include the fragment on client but not the server.

:read-more{icon="i-simple-icons-vuedotjs" to="https://router.vuejs.org/api/type-aliases/routelocationnormalizedloaded"}
