---
description: This function creates an error object with additional metadata.
---

# `createError`

You can use this function to create an error object with additional metadata. It is usable in the Vue and Nitro portions of the app and is supposed to get thrown.

**Parameters:**

* err: { cause, data, message, name, stack, statusCode, statusMessage, fatal }

## Throwing Errors in Your Vue App

If you throw an error created with `createError`:

* on the server side, it will trigger a full-screen error page which you can clear with `clearError`.
* on the client side, it will throw a non-fatal error for you to handle. If you need to trigger a full-screen error page, set `fatal: true`.

### Example

```vue [pages/movies/[slug].vue]
<script setup>
const route = useRoute()
const { data } = await useFetch(`/api/movies/${route.params.slug}`)
if (!data.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}
</script>
```

## Throwing Errors in API Routes

Use `createError` to trigger error handling in server API routes.

### Example

```js
export default eventHandler(() => {
  throw createError({
    statusCode: 404,
    statusMessage: 'Page Not Found'
  })
}
```

::ReadMore{link="/docs/getting-started/error-handling"}
::
