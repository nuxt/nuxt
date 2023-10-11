---
title: "useRequestHeaders"
description: "Use useRequestHeaders to access the incoming request headers."
---

# `useRequestHeaders`

You can use built-in [`useRequestHeaders`](/docs/api/composables/use-request-headers) composable to access the incoming request headers within your pages, components, and plugins.

```js
// Get all request headers
const headers = useRequestHeaders()

// Get only cookie request header
const headers = useRequestHeaders(['cookie'])
```

::alert{icon=👉}
In the browser, [`useRequestHeaders`](/docs/api/composables/use-request-headers) will return an empty object.
::

## Example

We can use [`useRequestHeaders`](/docs/api/composables/use-request-headers) to access and proxy the initial request's `authorization` header to any future internal requests during SSR.

The example below adds the `authorization` request header to an isomorphic `$fetch` call.

```vue [pages/some-page.vue]
<script setup lang="ts">
const { data } = await useFetch('/api/confidential', {
  headers: useRequestHeaders(['authorization'])
})
</script>
```

::alert{icon=👉}
[Another example](/docs/getting-started/data-fetching#example-pass-client-headers-to-the-api) shows how we can pass cookies from the initial request to another API route.
::
