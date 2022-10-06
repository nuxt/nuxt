---
title: "abortNavigation"
---

# `abortNavigation`

`abortNavigation` is a helper function that prevents navigation from taking place and throws an error if one is set as a parameter.

::alert{type="warning"}
`abortNavigation` is only usable inside a [route middleware handler](/guide/directory-structure/middleware).
::

## Type

```ts
abortNavigation(err?: Error | string): false
```

## Parameters

### `err`

- **Type**: [`Error`](https://developer.mozilla.org/pl/docs/Web/JavaScript/Reference/Global_Objects/Error) | `string`

  Optional error to be thrown by `abortNavigation`.

## Examples

The example below shows how you can use `abortNavigation` in a route middleware to prevent unauthorized route access:

```ts [middleware/auth.ts]
export default defineNuxtRouteMiddleware((to, from) => {
  const user = useState('user')

  if (!user.value.isAuthorized) {
    return abortNavigation()
  }
 
  return navigateTo('/edit-post')
})
```

### `err` as a String

You can pass the error as a string:

```ts [middleware/auth.ts]
export default defineNuxtRouteMiddleware((to, from) => {
  const auth = useState('auth')

  if (!user.value.isAuthorized) {
    abortNavigation('Insufficient permissions.')
  }
})
```

### `err` as an Error Object

You can pass the error as an [`Error`](https://developer.mozilla.org/pl/docs/Web/JavaScript/Reference/Global_Objects/Error) object, e.g. caught by the `catch`-block:

```ts [middleware/auth.ts]
export default defineNuxtRouteMiddleware((to, from) => {
  try {
    /* code that might throw an error */
  } catch (err) {
    abortNavigation(err)
  }
})
```
