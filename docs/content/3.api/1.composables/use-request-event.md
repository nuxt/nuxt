# `useRequestEvent`

Nuxt provides composables and utilities for first-class server-side-rendering support.

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
