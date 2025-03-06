---
title: 'defineLazyInteractionComponent'
description: 'Define a lazy hydration component with an interaction strategy.'
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/components/plugins/lazy-hydration-macro-transform.ts
    size: xs
---

`defineLazyInteractionComponent` is a compiler macro that allows you to define a lazy hydration component. This enables deferring the hydration of a component until the user interacts with it (e.g., click, mouseover).

## Usage

```vue
<script setup lang="ts">
const LazyInteractionMyComponent = defineLazyInteractionComponent(
  () => import('./components/MyComponent.vue')
)
</script>

<template>
  <div>
    <LazyInteractionMyComponent hydrate-on-interaction="mouseover" />
  </div>
</template>
```

## Props

### `hydrateOnInteraction` (optional)

- **Type**: `string | string[]`
- **Default**: `['pointerenter', 'click', 'focus']`

You can pass a string or an array of strings to specify the event(s) that will trigger hydration. The default events are `pointerenter`, `click`, and `focus`.

```vue
<template>
  <div>
    <!--
      Hydration will be triggered when
      the element(s) is hovered over by the pointer.
    -->
    <LazyInteractionMyComponent :hydrate-on-interaction="'pointerenter'" />
  </div>
</template>
```

## Emits

### `hydrated`

- **Type**: `() => void`

This event is emitted when the component is hydrated.
