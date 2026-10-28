---
title: "onNuxtReady"
description: The onNuxtReady composable allows running a callback after your app has finished initializing.
minimalVersion: "3.1"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ready.ts
    size: xs
---

::important
`onNuxtReady` only runs on the client-side. :br
It is ideal for running code that should not block the initial rendering of your app.
::

```ts [app/plugins/ready.client.ts]
export default defineNuxtPlugin(() => {
  onNuxtReady(async () => {
    const myAnalyticsLibrary = await import('my-big-analytics-library')
    // do something with myAnalyticsLibrary
  })
})
```

It is 'safe' to run even after your app has initialized. In this case, then the code will be registered to run in the next idle callback.

## Type

```ts [Signature]
export function onNuxtReady (callback: () => any, options?: OnNuxtReadyOptions): void

interface OnNuxtReadyOptions {
  timeout?: number
  signal?: AbortSignal
}
```

### `callback`

**Type**: `() => any`

The function to run once your app has finished initializing and the browser is idle.

### `options` (optional)

**Type**: `OnNuxtReadyOptions`

- `timeout` (optional)

  **Type**: `number`

  The maximum number of milliseconds to wait for the browser to become idle once your app is ready. It is passed to [`requestIdleCallback`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback#timeout). Without it, the callback may be delayed for several seconds if the browser does not schedule an idle period, which can happen in headless browsers.

```ts [app/plugins/ready.client.ts]
export default defineNuxtPlugin(() => {
  onNuxtReady(() => {
    // runs when the browser is idle, or about 2 seconds after your app is ready, whichever comes first
  }, { timeout: 2000 })
})
```

- `signal` (optional)

  **Type**: `AbortSignal`

  Skips the callback if the signal is aborted before it runs. This is useful when calling `onNuxtReady` from a component that may unmount before your app is ready.

```vue [app/components/MyComponent.vue]
<script setup lang="ts">
const controller = new AbortController()

onMounted(() => {
  onNuxtReady(() => {
    // does not run if the component unmounts first
  }, { signal: controller.signal })
})

onBeforeUnmount(() => controller.abort())
</script>
```
