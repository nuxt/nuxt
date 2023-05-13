---
title: "onNuxtReady"
description: The onNuxtReady composable allows running a callback after your app has finished initializing.
---

# `onNuxtReady`

The `onNuxtReady` composable allows running a callback after your app has finished initializing. It is ideal for running code that should not block the initial rendering of your app.

```ts
export default defineNuxtPlugin(() => {
  onNuxtReady(async () => {
    const myAnalyticsLibrary = await import('my-big-analytics-library')
    //Do something with myAnalyticsLibrary
  })
})
```

It is 'safe' to run even after your app has initialized. In this case, the code will register to run in the next idle callback.

::alert
`onNuxtReady` only runs on the client side.
::
