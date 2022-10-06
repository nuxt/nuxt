---
title: "useRequestHeaders"
description: "Use useRequestHeaders to access the incoming request headers."
---

# `useRequestHeaders`

Within your pages, components, and plugins you can use `useRequestHeaders` to access the incoming request headers.

```js
// Get all request headers
const headers = useRequestHeaders()

// Get only cookie request header
const headers = useRequestHeaders(['cookie'])
```

::alert{icon=👉}
In the browser, `useRequestHeaders` will return an empty object.
::
