---
title: "useError"
description: useError composable returns the global error Nuxt is handling.
---

# `useError`

The `useError` composable returns the global error that Nuxt is handling, available on both the client and server.

```ts
const error = useError()
```

`useError` sets an error in the state and creates a reactive and SSR-friendly global Nuxt error across components. Nuxt errors have the following properties:

## Properties

- **statusCode**

  Type: `Number`

  HTTP response status code

- **statusMessage**

  Type: `String`

  HTTP response status message

- **message**

  Type: `String`

  Error message

::ReadMore{link="/docs/getting-started/error-handling"}
::
