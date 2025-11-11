---
title: 'useCookie'
description: useCookie is an SSR-friendly composable to read and write cookies.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/cookie.ts
    size: xs
---

## Usage

Within your pages, components, and plugins, you can use `useCookie` to read and write cookies in an SSR-friendly way.

```ts
const cookie = useCookie(name, options)
```

::note
`useCookie` only works in the [Nuxt context](/docs/3.x/guide/going-further/nuxt-app#the-nuxt-context).
::

::tip
The returned ref will automatically serialize and deserialize cookie values to JSON.
::

## Type

```ts [Signature]
import type { Ref } from 'vue'
import type { CookieParseOptions, CookieSerializeOptions } from 'cookie-es'

export interface CookieOptions<T = any> extends Omit<CookieSerializeOptions & CookieParseOptions, 'decode' | 'encode'> {
  decode?(value: string): T
  encode?(value: T): string
  default?: () => T | Ref<T>
  watch?: boolean | 'shallow'
  readonly?: boolean
}

export interface CookieRef<T> extends Ref<T> {}

export function useCookie<T = string | null | undefined> (
  name: string,
  options?: CookieOptions<T>,
): CookieRef<T>
```

## Parameters

`name`: The name of the cookie.

`options`: Options to control cookie behavior. The object can have the following properties:

Most of the options will be directly passed to the [cookie](https://github.com/jshttp/cookie) package.

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `decode` | `(value: string) => T` | `decodeURIComponent` + [destr](https://github.com/unjs/destr). | Custom function to decode the cookie value.  Since the value of a cookie has a limited character set (and must be a simple string), this function can be used to decode a previously encoded cookie value into a JavaScript string or other object. <br/> **Note:** If an error is thrown from this function, the original, non-decoded cookie value will be returned as the cookie's value. |
| `encode` | `(value: T) => string` | `JSON.stringify` + `encodeURIComponent` | Custom function to encode the cookie value. Since the value of a cookie has a limited character set (and must be a simple string), this function can be used to encode a value into a string suited for a cookie's value. |
| `default` | `() => T \| Ref<T>` | `undefined` | Function returning the default value if the cookie does not exist.  The function can also return a `Ref`. |
| `watch` | `boolean \| 'shallow'` | `true`  | Whether to watch for changes and update the cookie. `true` for deep watch, `'shallow'` for shallow watch, i.e. data changes for only top level properties, `false` to disable. <br/> **Note:** Refresh `useCookie` values manually when a cookie has changed with [`refreshCookie`](/docs/3.x/api/utils/refresh-cookie). |
| `readonly` | `boolean` | `false` | If `true`, disables writing to the cookie. |
| `maxAge` | `number` | `undefined` | Max age in seconds for the cookie, i.e. the value for the [`Max-Age` `Set-Cookie` attribute](https://datatracker.ietf.org/doc/html/rfc6265#section-5.2.2). The given number will be converted to an integer by rounding down. By default, no maximum age is set. |
| `expires` | `Date` | `undefined` | Expiration date for the cookie. By default, no expiration is set. Most clients will consider this a "non-persistent cookie" and will delete it on a condition like exiting a web browser application. <br/> **Note:** The [cookie storage model specification](https://datatracker.ietf.org/doc/html/rfc6265#section-5.3) states that if both `expires` and `maxAge` is set, then `maxAge` takes precedence, but not all clients may obey this, so if both are set, they should point to the same date and time! <br/>If neither of `expires` and `maxAge` is set, the cookie will be session-only and removed when the user closes their browser. |
| `httpOnly` | `boolean` | `false` | Sets the HttpOnly attribute. <br/> **Note:** Be careful when setting this to `true`, as compliant clients will not allow client-side JavaScript to see the cookie in `document.cookie`. |
| `secure` | `boolean` | `false` | Sets the [`Secure` `Set-Cookie` attribute](https://datatracker.ietf.org/doc/html/rfc6265#section-5.2.5). <br/>**Note:** Be careful when setting this to `true`, as compliant clients will not send the cookie back to the server in the future if the browser does not have an HTTPS connection. This can lead to hydration errors. |
| `partitioned` | `boolean` | `false` | Sets the [`Partitioned` `Set-Cookie` attribute](https://datatracker.ietf.org/doc/html/draft-cutler-httpbis-partitioned-cookies#section-2.1). <br/>**Note:** This is an attribute that has not yet been fully standardized, and may change in the future. <br/>This also means many clients may ignore this attribute until they understand it.<br/>More information can be found in the [proposal](https://github.com/privacycg/CHIPS). |
| `domain` | `string` | `undefined` | Sets the [`Domain` `Set-Cookie` attribute](https://datatracker.ietf.org/doc/html/rfc6265#section-5.2.3). By default, no domain is set, and most clients will consider applying the cookie only to the current domain. |
| `path` | `string` | `'/'` | Sets the [`Path` `Set-Cookie` attribute](https://datatracker.ietf.org/doc/html/rfc6265#section-5.2.4). By default, the path is considered the ["default path"](https://datatracker.ietf.org/doc/html/rfc6265#section-5.1.4). |
| `sameSite` | `boolean \| string` | `undefined` | Sets the [`SameSite` `Set-Cookie` attribute](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-03#section-4.1.2.7). <br/>- `true` will set the `SameSite` attribute to `Strict` for strict same-site enforcement.<br/>- `false` will not set the `SameSite` attribute.<br/>- `'lax'` will set the `SameSite` attribute to `Lax` for lax same-site enforcement.<br/>- `'none'` will set the `SameSite` attribute to `None` for an explicit cross-site cookie.<br/>- `'strict'` will set the `SameSite` attribute to `Strict` for strict same-site enforcement. |

## Return Values

Returns a Vue `Ref<T>` representing the cookie value. Updating the ref will update the cookie (unless `readonly` is set). The ref is SSR-friendly and will work on both client and server.

## Examples

### Basic Usage

The example below creates a cookie called `counter`. If the cookie doesn't exist, it is initially set to a random value. Whenever we update the `counter` variable, the cookie will be updated accordingly.

```vue [app.vue]
<script setup lang="ts">
const counter = useCookie('counter')

counter.value ||= Math.round(Math.random() * 1000)
</script>

<template>
  <div>
    <h1>Counter: {{ counter || '-' }}</h1>
    <button @click="counter = null">
      reset
    </button>
    <button @click="counter--">
      -
    </button>
    <button @click="counter++">
      +
    </button>
  </div>
</template>
```

### Readonly Cookies

```vue
<script setup lang="ts">
const user = useCookie(
  'userInfo',
  {
    default: () => ({ score: -1 }),
    watch: false,
  },
)

if (user.value) {
  // the actual `userInfo` cookie will not be updated
  user.value.score++
}
</script>

<template>
  <div>User score: {{ user?.score }}</div>
</template>
```

### Writable Cookies

```vue
<script setup lang="ts">
const list = useCookie(
  'list',
  {
    default: () => [],
    watch: 'shallow',
  },
)

function add () {
  list.value?.push(Math.round(Math.random() * 1000))
  // list cookie won't be updated with this change
}

function save () {
  // the actual `list` cookie will be updated
  list.value &&= [...list.value]
}
</script>

<template>
  <div>
    <h1>List</h1>
    <pre>{{ list }}</pre>
    <button @click="add">
      Add
    </button>
    <button @click="save">
      Save
    </button>
  </div>
</template>
```

### Cookies in API Routes

You can use `getCookie` and `setCookie` from [`h3`](https://github.com/h3js/h3) package to set cookies in server API routes.

```ts [server/api/counter.ts]
export default defineEventHandler((event) => {
  // Read counter cookie
  let counter = getCookie(event, 'counter') || 0

  // Increase counter cookie by 1
  setCookie(event, 'counter', ++counter)

  // Send JSON response
  return { counter }
})
```

:link-example{to="/docs/3.x/examples/advanced/use-cookie"}
