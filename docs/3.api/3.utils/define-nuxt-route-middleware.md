---
title: "defineNuxtRouteMiddleware"
description: "Create named route middleware using defineNuxtRouteMiddleware helper function."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/router.ts
    size: xs
---

Route middleware are stored in the [`app/middleware/`](/docs/4.x/guide/directory-structure/app/middleware) of your Nuxt application (unless [set otherwise](/docs/4.x/api/nuxt-config#middleware)).

## Type

```ts [Signature]
export function defineNuxtRouteMiddleware (middleware: RouteMiddleware): RouteMiddleware

interface RouteMiddleware {
  (to: RouteLocationNormalized, from: RouteLocationNormalized): ReturnType<NavigationGuard>
}
```

## Parameters

### `middleware`

- **Type**: `RouteMiddleware`

A function that takes two Vue Router's route location objects as parameters: the next route `to` as the first, and the current route `from` as the second.

Learn more about available properties of `RouteLocationNormalized` in the **[Vue Router docs](https://router.vuejs.org/api/type-aliases/RouteLocationNormalized.html)**.

## Examples

### Showing Error Page

You can use route middleware to throw errors and show helpful error messages:

```ts [app/middleware/error.ts]
export default defineNuxtRouteMiddleware((to) => {
  if (to.params.id === '1') {
    throw createError({ status: 404, statusText: 'Page Not Found' })
  }
})
```

The above route middleware will redirect a user to the custom error page defined in the `~/error.vue` file, and expose the error message and code passed from the middleware.

### Redirection

Use [`useState`](/docs/4.x/api/composables/use-state) in combination with `navigateTo` helper function inside the route middleware to redirect users to different routes based on their authentication status:

```ts [app/middleware/auth.ts]
export default defineNuxtRouteMiddleware((to, from) => {
  const auth = useState('auth')

  if (!auth.value.isAuthenticated) {
    return navigateTo('/login')
  }

  if (to.path !== '/dashboard') {
    return navigateTo('/dashboard')
  }
})
```

Both [navigateTo](/docs/4.x/api/utils/navigate-to) and [abortNavigation](/docs/4.x/api/utils/abort-navigation) are globally available helper functions that you can use inside `defineNuxtRouteMiddleware`.
