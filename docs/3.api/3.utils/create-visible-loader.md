---
title: 'createVisibleLoader'
description: A utility function to customize delayed hydration based on visibility properties.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/hydrate.ts
    size: xs
---

You can use this utility to customize the conditions through which delayed hydration components would hydrate, based on their visiblity status and properties.

## Parameters

- `options`: `{ root, rootMargin, threshold }`

## Example

If you would like to change the threshold of the element:

```vue [pages/index.vue]
<template>
  <div>
    <LazyVisibleMyComponent :hydrate="createVisibleLoader({threshold: 0.2})"/>
  </div>
<template>
```
::read-more{to="/docs/guide/directory-structure/components#delayed-hydration"}
::

::read-more{to="https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API"}
This is based on the `IntersectionObserver` web API, and therefore only accepts the API's properties. You can specify only part of the properties, while the rest will default to the web API's defaults.
::
