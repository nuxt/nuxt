---
title: 'clearNuxtState'
description: Delete the cached state of useState.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/state.ts
    size: xs
---

::note
This method is useful if you want to invalidate the state of `useState`.  
You can also reset the state to the initial value passing a second parameter
:

## Type

```ts [Signature]
export function clearNuxtState (keys?: string | string[] | ((key: string) => boolean), reset?: boolean): void
```

## Parameters

- `keys`: One or an array of keys that are used in [`useState`](/docs/4.x/api/composables/use-state) to delete their cached state. If no keys are provided, **all state** will be invalidated.
- `reset`: Reset the state to the initial value passed into the `init` parameter of [`useState`](/docs/4.x/api/composables/use-state) instead of deleting the cached state. Resetting the state follows the same pattern as [`useAsyncData`](/docs/4.x/api/composables/use-async-data) when `clear` is being called.
