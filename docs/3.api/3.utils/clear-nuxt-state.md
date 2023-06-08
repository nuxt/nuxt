# `clearNuxtState`

Delete cached state of `useState`.

This method is useful if you want to invalidate the state of `useState`.

## Type

```ts
clearNuxtState (keys?: string | string[] | ((key: string) => boolean)): void
```

## Parameters

* `keys`: One or an array of keys that are used in `useState` to delete their cached state. If no keys are provided, **all state** will be invalidated.
