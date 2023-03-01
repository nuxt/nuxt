---
title: "$fetch"
description: Nuxt uses ofetch to expose globally the $fetch helper for making HTTP requests.
---

# `$fetch`

Nuxt uses [ofetch](https://github.com/unjs/ofetch) to expose globally the `$fetch` helper for making HTTP requests within your Vue app or API routes.

::ReadMore{link="/docs/getting-started/data-fetching"}
::

During server-side rendering, calling `$fetch` **on the server side** to fetch your internal [API routes](/docs/guide/directory-structure/server) will directly call the relevant function (emulating the request), **saving an additional API call**. However, when using server-side rendering, calling `$fetch` *on the client side* without wrapping it with `useAsyncData` causes fetching the data twice initially on the server, then again on the client, because `$fetch` does not transfer state from the server to the client. Thus, the fetch will be executed on both sides because the client has to get the data again. Use [`useFetch`](https://nuxt.com/docs/api/composables/use-fetch) or [`useAsyncData`](https://nuxt.com/docs/api/composables/use-async-data) with `$fetch` on the client side to prevent double data fetching.

```ts
<script setup>
// During SSR data is fetched twice, one on the server and one on the client.
const dataTwice = await $fetch("/api/item")
// During SSR data is fetched only on the server side and transferred to the client.
const { data } = await useAsyncData('item', () => $fetch('/api/item'))
// You can also useFetch as shortcut of useAsyncData + $fetch
const { data } = await useFetch('/api/item')
</script>
```

Note that `$fetch` is the preferred way to make HTTP calls in Nuxt 3 instead of [@nuxt/http](https://github.com/nuxt/http) and [@nuxtjs/axios](https://github.com/nuxt-community/axios-module) that are made for Nuxt 2.

During Using $fetch on client side without wrapping it with `useAsyncData` results in  `useFetch` or 

::NeedContribution
::
