---
title: "useRequestEvent"
description: "You can use useRequestEvent to access the incoming request."
---

# `useRequestEvent`

The `useRequestEvent` composable is usable within your pages, components, and plugins to access the incoming request.

```js
// Get underlying request event
const event = useRequestEvent()

// Get the URL
const url = event.node.req.url
```

::alert{icon=👉}
In the browser, `useRequestEvent` will return `undefined`.
::
