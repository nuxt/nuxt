---
title: "useResponseHeaders"
description: "Use useResponseHeaders to set multiple server response headers."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ssr.ts
    size: xs
---

You can use the built-in [`useResponseHeaders`](/docs/api/composables/use-response-headers) composable to set multiple server response headers within your pages, components, and plugins.

```ts
// Set the a custom response header
useResponseHeaders({ 'X-My-Header': 'my-value', 'X-My-Other-Header': 'my-other-value' });
```

::tip
As it is not retreiving values, `useResponseHeaders` never returns anything.
::

## Example

We can use `useResponseHeaders` to easily set response headers on a per-page basis.

```vue [pages/test.vue]
<script setup>
// pages/test.vue
useResponseHeaders({ 'X-My-Header': 'my-value', 'X-My-Other-Header': 'my-other-value' });
</script>

<template>
  <h1>Test page with custom headers</h1>
  <p>The response from the server for this "/test" page will have the custom headers.</p>
</template>
```

We can use `useResponseHeaders` for example in Nuxt [middleware](/docs/guide/directory-structure/middleware) to set response headers for all pages.

```ts [middleware/my-middleware.ts]
export default defineNuxtRouteMiddleware((to, from) => {
  useResponseHeaders({ 'X-My-Header': 'my-value', 'X-My-Other-Header': 'my-other-value' });
});
```
