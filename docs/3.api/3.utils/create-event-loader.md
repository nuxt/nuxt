---
title: 'createEventLoader'
description: A utility function to select the events used for event-based delayed hydration.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/hydrate.ts
    size: xs
---

You can use this utility to set specific events that would trigger hydration in event-based delayed hydration components.

## Parameters

- `options`: An array of valid HTML events.

## Example

If you would like to trigger hydration when the element is either clicked or has the mouse over it:

```vue [pages/index.vue]
<template>
  <div>
    <LazyEventMyComponent :hydrate="createEventLoader(['click','mouseover'])"/>
  </div>
<template>
```
::read-more{to="/docs/guide/directory-structure/components#delayed-hydration"}
::

::read-more{to="https://developer.mozilla.org/en-US/docs/Web/API/Element#events"}
Read more on the possible events that can be used.
::
