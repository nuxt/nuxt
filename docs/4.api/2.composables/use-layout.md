---
title: "useLayout"
description: useLayout returns the layout resolved for the current route.
minimalVersion: "4.5"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/layout.ts
    size: xs
---

## Description

`useLayout` returns a computed ref with the layout resolved for the current route, using the same chain as [`<NuxtLayout>`](/docs/4.x/api/components/nuxt-layout): the page's `layout` meta first, then the `appLayout` set via [route rules](/docs/4.x/guide/concepts/rendering#hybrid-rendering), then `'default'`.

Within a rendered `<NuxtLayout>` it reflects the enclosing layout; outside of one (for example in `app.vue`) it returns the layout that would be resolved for the current route.

Unlike reading `route.meta.layout` directly, this accounts for a layout set through route rules and stays in sync as the route changes.

## Return Values

A read-only computed ref resolving to the layout name (a `string`), or `false` when the layout is disabled.

## Example

```vue [app.vue]
<script setup lang="ts">
const layout = useLayout()
</script>

<template>
  <div>
    <CommandPalette v-if="layout !== 'minimal'" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
```
