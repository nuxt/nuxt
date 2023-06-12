---
title: "navigateTo"
description: navigateTo is a helper function that programmatically navigates users.
---

# `navigateTo`

`navigateTo` is a router helper function that allows programmatically navigating users through your Nuxt application.

`navigateTo` is available on both server side and client side. It can be used within plugins, middleware or can be called directly to perform page navigation.

## Type

```ts
navigateTo(to: RouteLocationRaw | undefined | null, options?: NavigateToOptions) => Promise<void | NavigationFailure> | RouteLocationRaw

interface NavigateToOptions {
  replace?: boolean
  redirectCode?: number
  external?: boolean
}
```

::alert{type="warning"}
Make sure to always use `await` or `return` on result of `navigateTo` when calling it.
::

## Parameters

### `to`

**Type**: [`RouteLocationRaw`](https://router.vuejs.org/api/interfaces/RouteLocation.html) | `undefined` | `null`

**Default**: `'/'`

`to` can be a plain string or a route object to redirect to. When passed as `undefined` or `null`, it will default to `'/'`.

### `options` (optional)

**Type**: `NavigateToOptions`

An object accepting the following properties:

- `replace` (optional)

  **Type**: `boolean`

  **Default**: `false`

  By default, `navigateTo` pushes the given route into the Vue Router's instance on the client side.

  This behavior can be changed by setting `replace` to `true`, to indicate that given route should be replaced.

- `redirectCode` (optional)

  **Type**: `number`

  **Default**: `302`

  `navigateTo` redirects to the given path and sets the redirect code to [`302 Found`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/302) by default when the redirection takes place on the server side.

  This default behavior can be modified by providing different `redirectCode`. Commonly, [`301 Moved Permanently`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/301) can be used for permanent redirections.

- `external` (optional)

  **Type**: `boolean`

  **Default**: `false`

  Allows navigating to an external URL when set to `true`. Otherwise, `navigateTo` will throw an error, as external navigation is not allowed by default.

## Examples

### Navigating Within a Vue Component

```vue
<script setup>
// passing 'to' as a string
await navigateTo('/search')

// ... or as a route object
await navigateTo({ path: '/search' })

// ... or as a route object with query parameters
await navigateTo({
  path: '/search',
  query: {
    page: 1,
    sort: 'asc'
  }
})
</script>
```

### Navigating Within Route Middleware

```ts
export default defineNuxtRouteMiddleware((to, from) => {
  if (to.path !== '/search') {
    // setting the redirect code to '301 Moved Permanently'
    return navigateTo('/search', { redirectCode: 301 })
  }
})
```

::ReadMore{link="/docs/guide/directory-structure/middleware"}
::

### Navigating to an External URL

```vue
<script setup>
// will throw an error;
// navigating to an external URL is not allowed by default
await navigateTo('https://nuxt.com')

// will redirect successfully with the 'external' parameter set to 'true'
await navigateTo('https://nuxt.com', {
  external: true
})
</script>
```
