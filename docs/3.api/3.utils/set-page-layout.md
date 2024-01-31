---
title: 'setPageLayout'
description: setPageLayout allows you to dynamically change the layout of a page. 
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/router.ts
    size: xs
---

::callout
`setPageLayout` allows you to dynamically change the layout of a page. It relies on access to the Nuxt context and therefore can only be called within the [Nuxt context](/docs/guide/going-further/nuxt-app#the-nuxt-context).
::

```ts [middleware/custom-layout.ts]
export default defineNuxtRouteMiddleware((to) => {
  // Set the layout on the route you are navigating _to_
  setPageLayout('other')
})
```

::callout
If you choose to set the layout dynamically on the server side, you _must_ do so before the layout is rendered by Vue (that is, within a plugin or route middleware) to avoid a hydration mismatch.
::
