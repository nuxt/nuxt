---
title: "useRequestHeaders"
description: "Use useRequestHeaders to access the incoming request headers."
---

# `useRequestHeaders`

You can use built-in `useRequestHeaders` composable to access the incoming request headers within your pages, components, and plugins.

```js
// Get all request headers
const headers = useRequestHeaders()

// Get only cookie request header
const headers = useRequestHeaders(['cookie'])
```

::alert{icon=👉}
In the browser, `useRequestHeaders` will return an empty object.
::

## Example

We can use `useRequestHeaders` to access and proxy the initial request's `authorization` header to any future internal requests during SSR.

The example below adds the `authorization` request header to an isomorphic `$fetch` call.

```vue [pages/some-page.vue]
<script setup>
const { data } = await useFetch('/api/confidential', {
  headers: useRequestHeaders(['authorization'])
})
</script>
```

::alert{icon=👉}
[Another example](/getting-started/data-fetching#example-pass-client-headers-to-the-api) shows how we can pass cookies from the initial request to another API route.
::
