---
title: useRuntimeHook
description: Registers a runtime hook in a Nuxt application and ensures it is properly disposed of when the scope is destroyed.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/hook.ts
    size: xs
---

::important
This composable is available in Nuxt v3.14+.
::

## Type

```ts [signature]
useRuntimeHook<THookName extends keyof RuntimeNuxtHooks>(name: THookName, fn: RuntimeNuxtHooks): void
```


