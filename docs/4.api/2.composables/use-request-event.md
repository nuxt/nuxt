---
title: 'useRequestEvent'
description: 'Access the incoming request event with the useRequestEvent composable.'
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ssr.ts
    size: xs
---

Within the [Nuxt context](/docs/guide/going-further/nuxt-app#the-nuxt-context) you can use `useRequestEvent` to access the incoming request.

```ts
// Get underlying request event
const event = useRequestEvent()

// Get the path of the incoming request
const path = event?.url.pathname

// Read a request header
const userAgent = event?.req.headers.get('user-agent')
```

::tip
In the browser, `useRequestEvent` will return `undefined`.
::

## Type

```ts
function useRequestEvent (nuxtApp?: NuxtApp): NuxtRequestEvent | undefined
```

`NuxtRequestEvent` is the event in the shape your configured [server builder](/docs/guide/going-further/builders) provides. With the default `@nuxt/nitro-server`, that is h3's `H3Event`.

When no server builder contributes an event type, the event resolves to `RequestEvent`, the web-standard part every server runtime provides:

| Property  | Type                                                          | Description                                                                 |
| --------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `req`     | `Request`                                                     | The incoming request, including its `headers`, `method` and body.           |
| `url`     | `URL`                                                         | The parsed request URL.                                                     |
| `res`     | `{ status?, statusText?, headers }`                           | The response status and headers to be sent.                                 |
| `context` | `RequestEventContext`                                         | Per-request state, including Nuxt's own state under `context.nuxt`.         |

Code that should work whichever server builder is configured (a module's server handler, for example) should only read these properties.

::read-more{to="/docs/guide/going-further/server-imports"}
Read more about writing portable server code with `nuxt/server`.
::
