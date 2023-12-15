---
title: "useRequestHeader"
description: "Use useRequestHeader to access a certain incoming request header."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ssr.ts
    size: xs
---

You can use built-in [`useRequestHeader`](/docs/api/composables/use-request-header) composable to access any incoming request header within your pages, components, and plugins.

```ts
// Get the authorization request header
const cookie = useRequestHeader('authorization')
```

::callout
In the browser, `useRequestHeader` will return an empty string.
::

## Example

We can use `useRequestHeader` to easily figure out if a user is authorized or not.

The example below reads the `authorization` request header to find out if a person can access a restricted resource.

```ts [middleware/authorized-only.ts]
export default defineNuxtRouteMiddleware((to, from) => {
  if(!useRequestHeader('authorization')){
    return navigateTo('/not-authorized')
  }
})
```
