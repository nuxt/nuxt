---
description: setPageLayout allows you to change the layout of a page dynamically. 
---
# `setPageLayout`

`setPageLayout` allows you to change the layout of a page dynamically. It relies on access to the Nuxt context and is callable only within components' setup functions, plugins, and route middleware.

```ts
export default defineNuxtRouteMiddleware((to) => {
  // Set the layout on the route you are navigating _to_
  setPageLayout('other')
})
```

::alert{icon=👉}
If you choose to set the layout dynamically on the server side, you _must_ do so before it is rendered by Vue (that is, within a plugin or route middleware) to avoid a hydration mismatch.
::
