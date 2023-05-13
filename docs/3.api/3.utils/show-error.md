# `showError`

Nuxt provides a quick, simple way to show a full-screen error page if needed.

The `showError` composable is usable within your pages, components, and plugins for showing an error.

**Parameters:**

- `error`: `string | Error | Partial<{ cause, data, message, name, stack, statusCode, statusMessage }>`

```js
showError("😱 Oh no, an error has been thrown.")
showError({ statusCode: 404, statusMessage: "Page Not Found" })
```

The error is set in the state using [`useError()`](/docs/api/composables/use-error) to create a reactive and SSR-friendly shared error state across components.

`showError` calls the `app:error` hook.

::ReadMore{link="/docs/getting-started/error-handling"}
::
