---
title: "useResponseHeader"
description: "Use useResponseHeader to set a server response header."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ssr.ts
    size: xs
---

You can use the built-in [`useResponseHeader`](/docs/api/composables/use-response-header) composable to set any server response header within your pages, components, and plugins.

```ts
// Set the a custom response header
useResponseHeader('X-My-Header', 'my-value');
```

::tip
As it is not retreiving a value, `useResponseHeader` never returns anything.
::

## Example

We can use `useResponseHeader` to easily set a response header on a per-page basis.

```vue [pages/test.vue]
<script setup>
// pages/test.vue
useResponseHeader('X-My-Header', 'my-value');
</script>

<template>
  <h1>Test page with custom header</h1>
  <p>The response from the server for this "/test" page will have a custom "X-My-Header" header.</p>
</template>
```

We can use `useResponseHeader` for example in Nuxt [middleware](/docs/guide/directory-structure/middleware) to set a response header for all pages.

```ts [middleware/my-middleware.ts]
export default defineNuxtRouteMiddleware((to, from) => {
  useResponseHeader('X-My-Header', 'my-value');
});
```
