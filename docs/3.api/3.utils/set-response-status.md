---
description: setResponseStatus sets the statusCode (and optionally the statusMessage) of the response.
---
# `setResponseStatus`

Nuxt provides composables and utilities for first-class server-side-rendering support.

`setResponseStatus` sets the statusCode (and optionally the statusMessage) of the response.

`setResponseStatus` can only be called within component setup functions, plugins, and route middleware.

```js
const event = useRequestEvent()

// Set the status code to 404 for a custom 404 page
setResponseStatus(event, 404)

// Set the status message as well
setResponseStatus(event, 404, 'Page Not Found')
```

::alert{icon=👉}
In the browser, `setResponseStatus` will have no effect.
::
