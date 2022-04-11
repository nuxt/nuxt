# `clearError`

Nuxt provides a composable to clear all handled errors.

Within your pages, components, and plugins, you can use `clearError` to clear all errors and redirect the user.

**Parameters:**

- `redirect` (optional): `string`

You can provide an optional path to redirect to (for example, if you want to navigate to a 'safe' page).

```js
// Without redirect
clearError()

// With redirect
clearError('/homepage')
```

Errors are set in state using [`useError()`](/api/composables/useError). The `clearError` composable will reset this state and calls the `app:error:cleared` hook with the provided options.

::ReadMore{link="/guide/features/error-handling"}
::
