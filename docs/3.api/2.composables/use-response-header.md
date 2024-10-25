---
title: "useResponseHeader"
description: "Use useResponseHeader to set a server response header."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ssr.ts
    size: xs
---

::important
This composable is available in Nuxt v3.14+.
::

You can use the built-in [`useResponseHeader`](/docs/api/composables/use-response-header) composable to set any server response header within your pages, components, and plugins.

```ts
// Set the a custom response header
const header = useResponseHeader('X-My-Header');
header.value = 'my-value';
```

## Example

We can use `useResponseHeader` to easily set a response header on a per-page basis.

```vue [pages/test.vue]
<script setup>
// pages/test.vue
const header = useResponseHeader('X-My-Header');
header.value = 'my-value';
</script>

<template>
  <h1>Test page with custom header</h1>
  <p>The response from the server for this "/test" page will have a custom "X-My-Header" header.</p>
</template>
```

We can use `useResponseHeader` for example in Nuxt [middleware](/docs/guide/directory-structure/middleware) to set a response header for all pages.

```ts [middleware/my-header-middleware.ts]
export default defineNuxtRouteMiddleware((to, from) => {
  const header = useResponseHeader('X-My-Always-Header');
  header.value = `I'm Always here!`;
});

```
