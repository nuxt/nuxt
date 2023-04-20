# `showError`

Nuxt provides a quick and simple way to show a full screen error page if needed.

Within your pages, components and plugins you can use `showError` to show an error.

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
