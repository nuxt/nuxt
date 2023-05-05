---
title: "$fetch"
description: Nuxt uses ofetch to globally expose the $fetch helper for making HTTP requests.
---

# `$fetch`

Nuxt uses [ofetch](https://github.com/unjs/ofetch) to expose the `$fetch` helper for making HTTP requests within your Vue app or API routes.

During server-side rendering, calling `$fetch` to fetch your internal [API routes](/docs/guide/directory-structure/server) will call the relevant function directly (emulating the request), **saving an additional API call**.

However, using `$fetch` in components without wrapping it with `useAsyncData` causes fetching the data twice: initially on the server, then again on the client side during hydration, because `$fetch` does not transfer state from the server to the client. Thus, the fetch will be executed on both sides because the client has to get the data again.

We recommend using [`useFetch`](https://nuxt.com/docs/api/composables/use-fetch) or [`useAsyncData`](https://nuxt.com/docs/api/composables/use-async-data) + `$fetch` to prevent double data fetching when fetching the component data.

```vue
<script setup>
// During SSR, data is fetched twice, once on the server and once on the client.
const dataTwice = await $fetch('/api/item')

// During SSR, data is fetched only on the server side and transferred to the client.
const { data } = await useAsyncData('item', () => $fetch('/api/item'))

// You can also useFetch as a shortcut for useAsyncData + $fetch
const { data } = await useFetch('/api/item')
</script>
```

:ReadMore{link="/docs/getting-started/data-fetching"}

You can use `$fetch` for any method executed only on the client side.

```vue
<script setup>
function contactForm() {
  $fetch('/api/contact', {
    method: 'POST',
    body: { hello: 'world '}
  })
}
</script>

<template>
  <button @click="contactForm">Contact</button>
</template>
```

`$fetch` is the preferred way to make HTTP calls in Nuxt instead of [@nuxt/http](https://github.com/nuxt/http) and [@nuxtjs/axios](https://github.com/nuxt-community/axios-module) that are for Nuxt 2.
