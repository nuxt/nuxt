---
title: 'createError'
description: Create an error object with additional metadata.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/error.ts
    size: xs
---

You can use this function to create an error object with additional metadata. It is usable in both the Vue and Nitro portions of your app, and is meant to be thrown.

## Parameters

- `err`: `string | { cause, data, message, name, stack, status, statusText, fatal }`

You can pass either a string or an object to the `createError` function. If you pass a string, it will be used as the error `message`, and the `status` will default to `500`. If you pass an object, you can set multiple properties of the error, such as `status`, `message`, and other error properties.

## In Vue App

If you throw an error created with `createError`:

- on server-side, it will trigger a full-screen error page which you can clear with `clearError`.
- on client-side, it will throw a non-fatal error for you to handle. If you need to trigger a full-screen error page, then you can do this by setting `fatal: true`.

### Example

```vue [app/pages/movies/[slug\\].vue]
<script setup lang="ts">
const route = useRoute()
const { data } = await useFetch(`/api/movies/${route.params.slug}`)
if (!data.value) {
  throw createError({ status: 404, statusText: 'Page Not Found' })
}
</script>
```

### Error Causes

You can pass a `cause` when creating an error to preserve the original error you are wrapping:

```ts
try {
  await fetchMovie(route.params.slug)
} catch (cause) {
  throw createError({
    status: 500,
    message: 'Could not load movie',
    cause,
  })
}
```

In development, the cause chain is exposed to your [error page](/docs/4.x/getting-started/error-handling#error-page) via the `cause` property of the error, serialized as `{ name, message, stack, cause }` (primitive causes are passed through as-is; other values are omitted). In production, causes are never included in error responses or in the error page payload.

## In API Routes

Use `createError` to trigger error handling in server API routes.

### Example

```ts [server/api/error.ts]
export default eventHandler(() => {
  throw createError({
    status: 404,
    statusText: 'Page Not Found',
  })
})
```

In API routes, using `createError` by passing an object with a short `statusText` is recommended because it can be accessed on the client side. Otherwise, a `message` passed to `createError` on an API route will not propagate to the client. Alternatively, you can use the `data` property to pass data back to the client. When handling the error with `useFetch`, the custom data is available at `error.value.data.data`. In any case, always consider avoiding to put dynamic user input to the message to avoid potential security issues.

:read-more{to="/docs/4.x/getting-started/error-handling"}
