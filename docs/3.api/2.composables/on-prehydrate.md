---
title: "onPrehydrate"
description: "Use onPrehydrate to run a callback on the client immediately before
Nuxt hydrates the page."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ssr.ts
    size: xs
---

::important
This composable will be available in Nuxt v3.12+.
::

`onPrehydrate` is a composable that allows you to run a callback on the client immediately before
Nuxt hydrates the page.

::note
This is an advanced composable and should be used with care.
::

The callback will be stringified and inlined in the HTML so it should not have any external
dependencies (such as auto-imports) or refer to variables defined outside the callback.

The callback will run before Nuxt runtime initializes so it should not rely on the Nuxt or Vue context.

## Example

```vue twoslash [app.vue]
<script setup lang="ts">
// onPrehydrate is guaranteed to run before Nuxt hydrates
onPrehydrate(() => {
  console.log(window)
})

// As long as it only has one root node, you can access the element
onPrehydrate((el) => {
  console.log(el.outerHTML)
  // <div data-v-inspector="app.vue:15:3" data-prehydrate-id="b3qlvSiBeH"> Hi there </div>
})

// For _very_ advanced use cases (such as not having a single root node) you
// can access/set `data-prehydrate-id` yourself
const prehydrateId = onPrehydrate((el) => {})
</script>

<template>
  <div>
    Hi there
  </div>
</template>
```
