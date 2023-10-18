---
title: 'setResponseStatus'
description: setResponseStatus sets the statusCode (and optionally the statusMessage) of the response.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ssr.ts
    size: xs
---

Nuxt provides composables and utilities for first-class server-side-rendering support.

`setResponseStatus` sets the statusCode (and optionally the statusMessage) of the response.

```js
const event = useRequestEvent()

// Set the status code to 404 for a custom 404 page
setResponseStatus(event, 404)

// Set the status message as well
setResponseStatus(event, 404, 'Page Not Found')
```

::callout
In the browser, `setResponseStatus` will have no effect.
::

:read-more{to="/docs/getting-started/error-handling"}
