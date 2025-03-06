---
title: 'defineLazyAfterComponent'
description: 'Define a lazy hydration component with a delay strategy.'
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/components/plugins/lazy-hydration-macro-transform.ts
    size: xs
---

`defineLazyAfterComponent` is a compiler macro that allows you to define a lazy hydration component. This enables delaying the hydration of a component until a specified time (in milliseconds) has passed.

When using `v-if="false"` on a lazy component, you might not need delayed hydration. You can just use a normal lazy component.

::tip
You can use `defineLazyAfterComponent` for non-essential components that do not need immediate hydration. This helps improve performance by deferring hydration until after a specified delay, reducing competition for main thread resources.
::

## Usage

```vue
<script setup lang="ts">
const LazyAfterMyComponent = defineLazyAfterComponent(
  () => import('./components/MyComponent.vue')
)
</script>

<template>
  <div>
    <LazyAfterMyComponent :hydrate-after="1000" />
  </div>
</template>
```

## Props

### `hydrateAfter`

- **Type**: `number`

Specify the delay (in milliseconds) before hydration occurs.

```vue
<template>
  <div>
    <!-- Hydration will be triggered after 1000ms. -->
    <LazyAfterMyComponent :hydrate-after="1000" />
  </div>
</template>
```

## Emits

### `hydrated`

- **Type**: `() => void`

This event is emitted when the component is hydrated.
