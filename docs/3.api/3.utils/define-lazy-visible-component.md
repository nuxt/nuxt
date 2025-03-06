---
title: 'defineLazyVisibleComponent'
description: 'Define a lazy hydration component with a visibility strategy.'
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/components/plugins/lazy-hydration-macro-transform.ts
    size: xs
---

`defineLazyVisibleComponent` is a compiler macro that allows you to define a lazy hydration component. This enables deferring the hydration of a component until the element(s) become visible in the viewport.

::note
Under the hood, this uses Vue's built-in [`hydrateOnVisible` strategy](https://vuejs.org/guide/components/async.html#hydrate-on-visible).
::

## Usage

```vue
<script setup lang="ts">
const LazyVisibleMyComponent = defineLazyVisibleComponent(
  () => import('./components/MyComponent.vue')
)
</script>

<template>
  <div>
    <LazyVisibleMyComponent />
  </div>
</template>
```

## Props

### `hydrateOnVisible` (optional)

- **Type**: `IntersectionObserverInit | true`
- **Default**: `true`

You can pass an object with options for the `IntersectionObserver` or `true` to use the default options.

```vue
<template>
  <div>
    <!--
      Hydration will be triggered when
      the element(s) is 100px away from entering the viewport.
    -->
    <LazyVisibleMyComponent :hydrate-on-visible="{ rootMargin: '100px' }" />
  </div>
</template>
```

::read-more{to="https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/IntersectionObserver" title="IntersectionObserver options"}
Read more about the options for `hydrate-on-visible`.
::

## Emits

### `hydrated`

- **Type**: `() => void`

This event is emitted when the component is hydrated.
