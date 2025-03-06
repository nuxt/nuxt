---
title: 'defineLazyIfComponent'
description: 'Define a lazy hydration component with a boolean condition.'
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/components/plugins/lazy-hydration-macro-transform.ts
    size: xs
---

`defineLazyIfComponent` is a compiler macro that allows you to define a lazy hydration component. This enables deferring the hydration of a component until a specified boolean condition is met.

## Usage

```vue
<script setup lang="ts">
const LazyIfMyComponent = defineLazyIfComponent(
  () => import('./components/MyComponent.vue')
)

const isReady = ref(false)

function myFunction() {
  // Trigger custom hydration strategy...
  isReady.value = true
}
</script>

<template>
  <div>
    <LazyIfMyComponent :hydrate-when="isReady" />
  </div>
</template>
```

## Props

### `hydrateWhen`

- **Type**: `boolean`
- **Default**: `true`

Specify a boolean value that determines when the component should be hydrated.

```vue
<template>
  <div>
    <!-- Hydration will be triggered when isReady becomes true. -->
    <LazyIfMyComponent :hydrate-when="isReady" />
  </div>
</template>
```

## Emits

### `hydrated`

- **Type**: `() => void`

This event is emitted when the component is hydrated.
