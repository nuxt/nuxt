---
title: 'showError'
description: Nuxt provides a quick and simple way to show a full screen error page if needed.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/error.ts
    size: xs
---

Within your pages, components and plugins you can use `showError` to show an error.

**Parameters:**

- `error`: `string | Error | Partial<{ cause, data, message, name, stack, statusCode, statusMessage }>`

```ts
showError("😱 Oh no, an error has been thrown.")
showError({
  statusCode: 404,
  statusMessage: "Page Not Found"
})
```

The error is set in the state using [`useError()`](/docs/api/composables/use-error) to create a reactive and SSR-friendly shared error state across components.

::callout
`showError` calls the `app:error` hook.
::

:read-more{to="/docs/getting-started/error-handling"}
