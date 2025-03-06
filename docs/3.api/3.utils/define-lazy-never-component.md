---
title: 'defineLazyNeverComponent'
description: 'Define a component that will never be hydrated.'
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/components/plugins/lazy-hydration-macro-transform.ts
    size: xs
---

`defineLazyNeverComponent` is a compiler macro that allows you to define a component that will never be hydrated. This means that the component remains static and does not require Vue's hydration process.

When using `v-if="false"` on a lazy component, you might not need delayed hydration. You can just use a normal lazy component.

::note
This component will never be hydrated by Vue. It is useful for components that only rely on static HTML and CSS without any client-side interaction. But if a component requires user interaction, it should not be set to never hydrate.
::

## Usage

```vue
<script setup lang="ts">
const LazyNeverMyComponent = defineLazyNeverComponent(
  () => import('./components/MyComponent.vue')
)
</script>

<template>
  <div>
    <LazyNeverMyComponent />
  </div>
</template>
```
