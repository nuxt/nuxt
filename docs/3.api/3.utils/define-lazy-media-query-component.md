---
title: 'defineLazyMediaQueryComponent'
description: 'Define a lazy hydration component with a media query strategy.'
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/components/plugins/lazy-hydration-macro-transform.ts
    size: xs
---

`defineLazyMediaQueryComponent` is a compiler macro that allows you to define a lazy hydration component. This enables deferring the hydration of a component until the specified media query is matched.

When using `v-if="false"` on a lazy component, you might not need delayed hydration. You can just use a normal lazy component.

::tip
You can use `defineLazyMediaQueryComponent` for components that should only be hydrated under specific screen sizes or device conditions. This helps optimize rendering by ensuring hydration only occurs when necessary.
::

## Usage

```vue
<script setup lang="ts">
const LazyMediaQueryMyComponent = defineLazyMediaQueryComponent(
  () => import('./components/MyComponent.vue')
)
</script>

<template>
  <div>
    <LazyMediaQueryMyComponent hydrate-on-media-query="(min-width: 768px)" />
  </div>
</template>
```

## Props

### `hydrateOnMediaQuery`

- **Type**: `string`

Pass a media query string to specify the condition that will trigger hydration.

```vue
<template>
  <div>
    <!--
      Hydration will be triggered when
      the window width is greater than or equal to 768px.
    -->
    <LazyMediaQueryMyComponent hydrate-on-media-query="min-width: 768px" />
  </div>
</template>
```

## Emits

### `hydrated`

- **Type**: `() => void`

This event is emitted when the component is hydrated.
