---
title: 'useRequestFetch'
description: 'Access the same $fetch instance used during server-side rendering with useRequestFetch.'
minimalVersion: "3.2"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ssr.ts
    size: xs
---

`useRequestFetch` returns the same [`$fetch`](/docs/4.x/api/utils/dollarfetch) instance Nuxt uses during SSR. It does **not** forward browser cookies or other request headers for you.

During SSR, forward the headers you need with [`useRequestHeaders`](/docs/4.x/api/composables/use-request-headers):

```vue [app/pages/index.vue]
<script setup lang="ts">
const { data } = await useAsyncData(() => $fetch('/api/cookies', {
  headers: useRequestHeaders(['cookie']),
}))
</script>
```

::read-more{to="/docs/4.x/getting-started/data-fetching#pass-client-headers-to-the-api"}
See Pass Client Headers to the API for more detail.
::

::tip
In the browser during client-side navigation, `useRequestFetch` behaves like regular [`$fetch`](/docs/4.x/api/utils/dollarfetch).
::
