---
title: useRuntimeHook
description: Registers a runtime hook in a Nuxt application and ensures it is properly disposed of when the scope is destroyed.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/runtime-hook.ts
    size: xs
---

::important
This composable is available in Nuxt v3.14+.
::

```ts [signature]
function useRuntimeHook<THookName extends keyof RuntimeNuxtHooks>(
  name: THookName,
  fn: RuntimeNuxtHooks[THookName] extends HookCallback ? RuntimeNuxtHooks[THookName] : never
): void
```

## Usage

### Parameters

- `name`: The name of the runtime hook to register. You can see the full list of [runtime Nuxt hooks here](/docs/api/advanced/hooks#app-hooks-runtime).
- `fn`: The callback function to execute when the hook is triggered. The function signature varies based on the hook name.

### Returns

The composable doesn't return a value, but it automatically unregisters the hook when the component's scope is destroyed.

## Example

```vue twoslash [pages/index.vue]
<script setup lang="ts">
// Register a hook that runs every time a link is prefetched, but which will be
// automatically cleaned up (and not called again) when the component is unmounted
useRuntimeHook('link:prefetch', (link) => {
  console.log('Prefetching', link)
})
</script>
```
