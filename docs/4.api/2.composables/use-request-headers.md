---
title: "useRequestHeaders"
description: "Use useRequestHeaders to access the incoming request headers."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ssr.ts
    size: xs
---

You can use built-in [`useRequestHeaders`](/docs/4.x/api/composables/use-request-headers) composable to access the incoming request headers within your pages, components, and plugins.

```ts
// Get all request headers
const headers = useRequestHeaders()

// Get only cookie request header
const { cookie } = useRequestHeaders(['cookie'])
```

::tip
In the browser, `useRequestHeaders` will return an empty object.
::

## Example

During SSR, `$fetch` and `useFetch` do not attach browser cookies or other request headers to internal API calls. Use `useRequestHeaders` to pass the headers you need.

The example below forwards the `authorization` header with `useFetch`. Use the same pattern for `cookie` when your API route reads session cookies.

```vue [app/pages/some-page.vue]
<script setup lang="ts">
const { data } = await useFetch('/api/confidential', {
  headers: useRequestHeaders(['authorization']),
})
</script>
```

::read-more{to="/docs/4.x/getting-started/data-fetching#pass-client-headers-to-the-api"}
See Pass Client Headers to the API for cookie examples and guidance on external APIs.
::
