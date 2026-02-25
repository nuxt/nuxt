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
This method is useful if you want to invalidate the state of `useState`. You can also reset the state to its initial value by passing `{ reset: true }` as the second parameter.
::

## Type

```ts [Signature]
export function clearNuxtState (keys?: string | string[] | ((key: string) => boolean), opts?: ClearNuxtStateOptions): void
```

## Parameters

- `keys`: One or an array of keys that are used in [`useState`](/docs/4.x/api/composables/use-state) to delete their cached state. If no keys are provided, **all state** will be invalidated.
- `opts`: An options object to configure the clear behavior.
  - `reset`: When set to `true`, resets the state to the initial value provided by the `init` function of [`useState`](/docs/4.x/api/composables/use-state) instead of setting it to `undefined`. Defaults to `false`.
