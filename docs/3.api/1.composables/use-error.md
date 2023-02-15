---
title: "useError"
description: useError composable returns the global Nuxt error that is being handled.
---

# `useError`

`useError` composable returns the global Nuxt error that is being handled and it is available on both client and server.

```ts
const error = useError()
```

`useError` sets an error in the state and creates a reactive as well as SSR-friendly global Nuxt error across components. Nuxt errors have the following properties:

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
