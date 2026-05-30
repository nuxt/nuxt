---
title: 'useRequestFetch'
description: 'Forward the request context and headers for server-side fetch requests with the useRequestFetch composable.'
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ssr.ts
    size: xs
---

You can use `useRequestFetch` to forward the request context and headers when making server-side fetch requests.

When making a client-side fetch request, the browser automatically sends the necessary headers.
However, when making a request during server-side rendering, due to security considerations, we need to forward the headers manually.

::note
Headers that are **not meant to be forwarded** will **not be included** in the request. These headers include, for example:
`transfer-encoding`, `connection`, `keep-alive`, `upgrade`, `expect`, `host`, `accept`
::

::tip
The [`useFetch`](/docs/4.x/api/composables/use-fetch) composable uses `useRequestFetch` under the hood to automatically forward the request context and headers.
::

::note
This also applies to request-scoped runtime context on server presets such as Cloudflare Workers and Cloudflare Pages.
For example, if an internal server route reads Cloudflare bindings from `event.context`, call it with `useRequestFetch` inside [`useAsyncData`](/docs/4.x/api/composables/use-async-data), or use [`useFetch`](/docs/4.x/api/composables/use-fetch) with a relative URL, so the route receives the current request event context.
::

::code-group

```vue [app/pages/index.vue]
<script setup lang="ts">
// This will forward the user's headers to the `/api/cookies` event handler
// Result: { cookies: { foo: 'bar' } }
const requestFetch = useRequestFetch()
const { data: forwarded } = await useAsyncData(() => requestFetch('/api/cookies'))

// This will NOT forward anything
// Result: { cookies: {} }
const { data: notForwarded } = await useAsyncData((_nuxtApp, { signal }) => $fetch('/api/cookies', { signal }))
</script>
```

```ts [server/api/cookies.ts]
export default defineEventHandler((event) => {
  const cookies = parseCookies(event)

  return { cookies }
})
```

::

::tip
In the browser during client-side navigation, `useRequestFetch` will behave just like regular [`$fetch`](/docs/4.x/api/utils/dollarfetch).
::
