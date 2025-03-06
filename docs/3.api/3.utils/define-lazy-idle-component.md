---
title: 'defineLazyIdleComponent'
description: 'Define a lazy hydration component with an idle strategy.'
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/components/plugins/lazy-hydration-macro-transform.ts
    size: xs
---

`defineLazyIdleComponent` is a compiler macro that allows you to define a lazy hydration component. This enables deferring the hydration of a component until the browser is idle. It is useful when you want the component to load as soon as possible without blocking the critical rendering path.

::note
Under the hood, this uses Vue's built-in [`hydrateOnIdle` strategy](https://vuejs.org/guide/components/async.html#hydrate-on-idle).
::

## Usage

```vue
<script setup lang="ts">
const LazyIdleMyComponent = defineLazyIdleComponent(
  () => import('./components/MyComponent.vue')
)
</script>

<template>
  <div>
    <LazyIdleMyComponent />
  </div>
</template>
```

## Props

### `hydrateOnIdle` (optional)

- **Type**: `number | true`
- **Default**: `true`

You can pass a number to specify a timeout duration. If hydration has not been triggered within this duration, it will occur automatically. Alternatively, pass `true` to use the default timeout duration. The number must be a positive value; otherwise, it will be ignored.

```vue
<template>
  <div>
    <!-- Hydration will be triggered when the browser is idle or after 2000ms. -->
    <LazyIdleMyComponent :hydrate-on-idle="2000" />
  </div>
</template>
```

## Emits

### `hydrated`

- **Type**: `() => void`

This event is emitted when the component is hydrated.
