---
title: "onPrehydrate"
description: "Use onPrehydrate to run a callback on the client immediately before Nuxt hydrates the page."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ssr.ts
    size: xs
---

::important
This composable is available in Nuxt v3.12+.
::

`onPrehydrate` is a composable lifecycle hook that allows you to run a callback on the client immediately before Nuxt hydrates the page.
::note
This is an advanced utility and should be used with care. For example, [`nuxt-time`](https://github.com/danielroe/nuxt-time/pull/251) and [`@nuxtjs/color-mode`](https://github.com/nuxt-modules/color-mode/blob/main/src/script.js) manipulate the DOM to avoid hydration mismatches.
::

## Usage

Call `onPrehydrate` in the setup function of a Vue component (e.g., in `<script setup>`) or in a plugin. It only has an effect when called on the server and will not be included in your client build.

## Type

```ts [Signature]
export function onPrehydrate(callback: (el: HTMLElement) => void): void
export function onPrehydrate(callback: string | ((el: HTMLElement) => void), key?: string): undefined | string
```

## Parameters

| Parameter | Type | Required | Description |
| ---- | --- | --- | --- |
| `callback` | `((el: HTMLElement) => void) \| string` | Yes | A function (or stringified function) to run before Nuxt hydrates. It will be stringified and inlined in the HTML. Should not have external dependencies or reference variables outside the callback. Runs before Nuxt runtime initializes, so it should not rely on Nuxt or Vue context. |
| `key` | `string` | No | (Advanced) A unique key to identify the prehydrate script, useful for advanced scenarios like multiple root nodes. |

## Return Values

- Returns `undefined` when called with only a callback function.
- Returns a string (the prehydrate id) when called with a callback and a key, which can be used to set or access the `data-prehydrate-id` attribute for advanced use cases.

## Example

```vue twoslash [app/app.vue]
<script setup lang="ts">
declare const window: Window
// ---cut---
// Run code before Nuxt hydrates
onPrehydrate(() => {
  console.log(window)
})

// Access the root element
onPrehydrate((el) => {
  console.log(el.outerHTML)
  // <div data-v-inspector="app.vue:15:3" data-prehydrate-id=":b3qlvSiBeH:"> Hi there </div>
})

// Advanced: access/set `data-prehydrate-id` yourself
const prehydrateId = onPrehydrate((el) => {})
</script>

<template>
  <div>
    Hi there
  </div>
</template>
```
