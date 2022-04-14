# `useError`

Nuxt provides a composable to catch global errors.

This function will return the global Nuxt error that is being handled.

```ts
const error = useError()
```

`useError` set an error in state, create a reactive and SSR-friendly global Nuxt error across components.

::ReadMore{link="/guide/features/error-handling"}
::
