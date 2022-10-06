---
title: "useRequestEvent"
description: "You can use useRequestEvent to access the incoming request."
---

# `useRequestEvent`

Within your pages, components, and plugins you can use `useRequestEvent` to access the incoming request.

```js
// Get underlying request event
const event = useRequestEvent()

// Get the URL
const url = event.req.url
```

::alert{icon=👉}
In the browser, `useRequestEvent` will return `undefined`.
::
