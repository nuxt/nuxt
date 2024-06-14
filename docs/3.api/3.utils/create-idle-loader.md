---
title: 'createIdleLoader'
description: A utility function to customize delayed hydration based on network idle time.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/hydrate.ts
    size: xs
---

You can use this utility to customize the timeout of delayed hydration components based on network idle time.

## Parameters

- `options`: `{ timeout }`

## Example

If you would like to give a timeout of 5 seconds for the components:

```vue [pages/index.vue]
<template>
  <div>
    <LazyIdleMyComponent :loader="createIdleLoader({timeout: 3000})"/>
  </div>
<template>
```
::read-more{to="/docs/guide/directory-structure/components#delayed-hydration"}
::

::read-more{to="https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback"}
This is based on the `requestIdleCallback` web API, and therefore only accepts the timeout prop, which should be a number.
::
