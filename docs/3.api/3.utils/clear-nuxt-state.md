---
title: 'clearNuxtState'
description: Delete the cached state of useState.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/state.ts
    size: xs
---

::callout
This method is useful if you want to invalidate the state of `useState`.
::

## Type

```ts
clearNuxtState (keys?: string | string[] | ((key: string) => boolean)): void
```

## Parameters

- `keys`: One or an array of keys that are used in [`useState`](/docs/api/composables/use-state) to delete their cached state. If no keys are provided, **all state** will be invalidated.
