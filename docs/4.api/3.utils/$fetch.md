---
title: "$fetch"
description: Nuxt uses ofetch to expose globally the $fetch helper for making HTTP requests.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/entry.ts
    size: xs
---

Nuxt uses [ofetch](https://github.com/unjs/ofetch) to expose globally the `$fetch` helper for making HTTP requests within your Vue app or API routes.

::tip{icon="i-lucide-rocket"}
During server-side rendering, calling `$fetch` to fetch your internal [API routes](/docs/4.x/directory-structure/server) will directly call the relevant function (emulating the request), **saving an additional API call**.
::

::note{color="blue" icon="i-lucide-info"}
Using `$fetch` in components without wrapping it with [`useAsyncData`](/docs/4.x/api/composables/use-async-data) causes fetching the data twice: initially on the server, then again on the client-side during hydration, because `$fetch` does not transfer state from the server to the client. Thus, the fetch will be executed on both sides because the client has to get the data again.
::

## Usage

We recommend using [`useFetch`](/docs/4.x/api/composables/use-fetch) or [`useAsyncData`](/docs/4.x/api/composables/use-async-data) + `$fetch` to prevent double data fetching when fetching the component data.

```vue [app/app.vue]
<script setup lang="ts">
// During SSR data is fetched twice, once on the server and once on the client.
const dataTwice = await $fetch('/api/item')

// During SSR data is fetched only on the server side and transferred to the client.
const { data } = await useAsyncData('item', () => $fetch('/api/item'))

// You can also useFetch as shortcut of useAsyncData + $fetch
const { data } = await useFetch('/api/item')
</script>
```

:read-more{to="/docs/4.x/getting-started/data-fetching"}

You can use `$fetch` in any methods that are executed only on client-side.

```vue [app/pages/contact.vue]
<script setup lang="ts">
async function contactForm () {
  await $fetch('/api/contact', {
    method: 'POST',
    body: { hello: 'world' },
  })
}
</script>

<template>
  <button @click="contactForm">
    Contact
  </button>
</template>
```

::tip
`$fetch` is the preferred way to make HTTP calls in Nuxt instead of [@nuxt/http](https://github.com/nuxt/http) and [@nuxtjs/axios](https://github.com/nuxt-community/axios-module) that are made for Nuxt 2.
::

::note
If you use `$fetch` to call an (external) HTTPS URL with a self-signed certificate in development, you will need to set `NODE_TLS_REJECT_UNAUTHORIZED=0` in your environment.
::

### Passing Headers and Cookies

When you call `$fetch` in the browser, the browser sends headers such as `cookie` to the API.

During SSR, `$fetch` does not include the user's browser cookies, and it does not pass cookies from the fetch response back to the client. This limits risks such as **Server-Side Request Forgery (SSRF)** and authentication misuse.

::code-group

```vue [app/pages/index.vue]
<script setup lang="ts">
// This will NOT forward headers or cookies during SSR
const { data } = await useAsyncData(() => $fetch('/api/cookies'))
</script>
```

```ts [server/api/cookies.ts]
export default defineEventHandler((event) => {
  const foo = getCookie(event, 'foo')
  // ... Do something with the cookie
})
```
::

Forward the headers you need with [`useRequestHeaders`](/docs/4.x/api/composables/use-request-headers):

```vue [app/pages/index.vue]
<script setup lang="ts">
// This forwards the cookie header to `/api/cookies` during SSR
const { data } = await useAsyncData(() => $fetch('/api/cookies', {
  headers: useRequestHeaders(['cookie']),
}))
</script>
```

The same approach works with [`useFetch`](/docs/4.x/api/composables/use-fetch). See [Pass Client Headers to the API](/docs/4.x/getting-started/data-fetching#pass-client-headers-to-the-api).
