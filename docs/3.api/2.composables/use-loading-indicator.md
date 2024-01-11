---
title: 'useLoadingIndicator'
description: This composable gives you access to the loading state of the app page.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/loading-indicator.ts
    size: xs
---

## Description

A composable which returns the loading state of the page. Used by [`<NuxtLoadingIndicator>`](/docs/api/components/nuxt-loading-indicator) and controllable.
It hooks into [`page:loading:start`](/docs/api/advanced/hooks#app-hooks-runtime) and [`page:loading:end`](/docs/api/advanced/hooks#app-hooks-runtime) to change its state.

## Parameters

- `duration`: Duration of the loading bar, in milliseconds (default `2000`).
- `throttle`: Throttle the appearing and hiding, in milliseconds (default `200`).
- `progressionRate`: The steepness of the non-linear function used in calculating progress. A lower value results in a steeper curve, meaning faster initial progress that slows down more sharply towards the end. (default `50`);


## Properties

### `isLoading`

- **type**: `Ref<boolean>`
- **description**: The loading state

### `progress`

- **type**: `Ref<number>`
- **description**: The progress state. From `0` to `100`.

## Methods

### `start()`

Set `isLoading` to true and start to increase the `progress` value.

### `finish()`

Set the `progress` value to `100`, stop all timers and intervals then reset the loading state `500` ms later.

### `clear()`

Used by `finish()`. Clear all timers and intervals used by the composable.

## Example

```ts
<script setup lang="ts">
  const { progress, isLoading, start, finish, clear } = useLoadingIndicator({
    duration: 2000,
    throttle: 200,
    progressTimingFunction: (duration, elapsed) => elapsed / duration * 100
  })
</script>
```