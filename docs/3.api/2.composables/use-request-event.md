---
title: 'useRequestEvent'
description: 'Access the incoming request event with the useRequestEvent composable.'
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ssr.ts
    size: xs
---

Within your pages, components, and plugins you can use `useRequestEvent` to access the incoming request.

```ts
// Get underlying request event
const event = useRequestEvent()

// Get the URL
const url = event.path
```

::callout
In the browser, `useRequestEvent` will return `undefined`.
::
