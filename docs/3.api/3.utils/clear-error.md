---
title: "clearError"
description: "The clearError composable clears all handled errors."
---

# `clearError`

Within your pages, components, and plugins, you can use `clearError` to clear all errors and redirect the user.

**Parameters:**

- `options?: { redirect?: string }`

You can provide an optional path to redirect to (for example, if you want to navigate to a 'safe' page).

```js
// Without redirect
clearError()

// With redirect
clearError({ redirect: '/homepage' })
```

Errors are set in state using [`useError()`](/docs/api/composables/use-error). The `clearError` composable will reset this state and calls the `app:error:cleared` hook with the provided options.

::ReadMore{link="/docs/getting-started/error-handling"}
::
