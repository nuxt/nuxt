---
title: "useError"
description: useError composable returns the global Nuxt error that is being handled.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/error.ts
    size: xs
---

The composable returns the global Nuxt error that is being handled and it is available on both client and server.

```ts
const error = useError()
```

`useError` sets an error in the state and creates a reactive as well as SSR-friendly global Nuxt error across components.

Nuxt errors have the following properties:

```ts
interface {
  //  HTTP response status code
  statusCode: number
  // HTTP response status message
  statusMessage: string
  // Error message
  message: string
}
```

:read-more{to="/docs/getting-started/error-handling"}
