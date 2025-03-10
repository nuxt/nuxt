---
title: 'defineLazyHydrationComponent'
description: 'Define a lazy hydration component with a specific strategy.'
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/components/plugins/lazy-hydration-macro-transform.ts
    size: xs
---

`defineLazyHydrationComponent` is a compiler macro that enables lazy hydration with specific strategy. In SSR, Vue needs to hydrate the entire component to ensure that it remains interactive. Lazy hydration defers this process using different strategies, which is very helpful for reducing the initial performance cost, especially for non-essential components.

## Usage

### Visibility Strategy

Visibility strategy enables deferring the hydration of a component until the element(s) become visible in the viewport.

```vue
<script setup lang="ts">
const LazyHydrationMyComponent = defineLazyHydrationComponent(
  'visible',
  () => import('./components/MyComponent.vue')
)
</script>

<template>
  <div>
    <!-- 
      Hydration will be triggered when
      the element(s) is 100px away from entering the viewport.
    -->
    <LazyHydrationMyComponent :hydrate-on-visible="{ rootMargin: '100px' }" />
  </div>
</template>
```

### Idle Strategy

Idle strategy enables deferring the hydration of a component until the browser is idle, ensuring that critical rendering tasks are prioritized first.

```vue
<script setup lang="ts">
const LazyHydrationMyComponent = defineLazyHydrationComponent(
  'idle',
  () => import('./components/MyComponent.vue')
)
</script>

<template>
  <div>
    <!-- Hydration will be triggered when the browser is idle or after 2000ms. -->
    <LazyHydrationMyComponent :hydrate-on-idle="2000" />
  </div>
</template>
```

### Interaction Strategy

Interaction strategy enables delaying the hydration of a component until a user interacts with it (e.g., click, mouseover).

```vue
<script setup lang="ts">
const LazyHydrationMyComponent = defineLazyHydrationComponent(
  'interaction',
  () => import('./components/MyComponent.vue')
)
</script>

<template>
  <div>
    <!--
      Hydration will be triggered when
      the element(s) is hovered over by the pointer.
    -->
    <LazyHydrationMyComponent hydrate-on-interaction="mouseover" />
  </div>
</template>
```

### Media Query Strategy

Media query strategy enables deferring the hydration of a component until a specified media query matches.

```vue
<script setup lang="ts">
const LazyHydrationMyComponent = defineLazyHydrationComponent(
  'mediaQuery',
  () => import('./components/MyComponent.vue')
)
</script>

<template>
  <div>
    <!--
      Hydration will be triggered when
      the window width is greater than or equal to 768px.
    -->
    <LazyHydrationMyComponent hydrate-on-media-query="(min-width: 768px)" />
  </div>
</template>
```

### If Strategy

If strategy enables delaying the hydration of a component until a boolean condition is met.

```vue
<script setup lang="ts">
const LazyHydrationMyComponent = defineLazyHydrationComponent(
  'if',
  () => import('./components/MyComponent.vue')
)

const isReady = ref(false)

function myFunction() {
  // Trigger custom hydration strategy...
  isReady.value = true
}
</script>

<template>
  <div>
    <!-- Hydration is triggered when isReady becomes true. -->
    <LazyHydrationMyComponent :hydrate-when="isReady" />
  </div>
</template>
```

### Time Strategy

Time strategy enables delaying the hydration of a component until a specified time (in milliseconds) has passed.

```vue
<script setup lang="ts">
const LazyHydrationMyComponent = defineLazyHydrationComponent(
  'time', 
  () => import('./components/MyComponent.vue')
)
</script>

<template>
  <div>
    <!-- Hydration is triggered after 1000ms. -->
    <LazyHydrationMyComponent :hydrate-after="1000" />
  </div>
</template>
```

### Never Hydrate

Never strategy prevents the component from being hydrated by Vue. This means that the component remains static and does not require Vue's hydration process.

```vue
<script setup lang="ts">
const LazyHydrationMyComponent = defineLazyHydrationComponent(
  'never',
  () => import('./components/MyComponent.vue')
)
</script>

<template>
  <div>
    <!-- This component will never be hydrated by Vue. -->
    <LazyHydrationMyComponent />
  </div>
</template>
```

## Parameters

### `strategy`

- **Type**: `'visible' | 'idle' | 'interaction' | 'mediaQuery' | 'if' | 'time' | 'never'`
- **Required**: `true`

| Strategy     | Description                                                      |
|-------------|------------------------------------------------------------------|
| `visible`   | Hydrates when the component becomes visible in the viewport.     |
| `idle`      | Hydrates when the browser is idle or after a delay.             |
| `interaction` | Hydrates upon user interaction (e.g., click, hover).          |
| `mediaQuery` | Hydrates when the specified media query condition is met.      |
| `if`        | Hydrates when a specified boolean condition is met.             |
| `time`      | Hydrates after a specified time delay.                          |
| `never`     | Prevents Vue from hydrating the component.                      |

### `source`

- **Type**: `() => Promise<Component>`
- **Required**: `true`

A function that returns a `Promise` for the component to be hydrated.
