---
title: "useRequestEvent"
description: "You can use useRequestEvent to access the incoming request."
---

# `useRequestEvent`

Within a [Nuxt context](/docs/guide/going-further/nuxt-app#the-nuxt-context) scope you can use `useRequestEvent` to access the incoming request.

```js
// Get underlying request event
const event = useRequestEvent()

// Get the URL
const url = event.path
```

::alert{icon=👉}
In the browser, `useRequestEvent` will return `undefined`.
::
