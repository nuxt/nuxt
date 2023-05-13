---
description: useCookie is an SSR-friendly composable to read and write cookies.
---

# `useCookie`

Within your pages, components, and plugins you can use `useCookie`, an SSR-friendly composable to read and write cookies.

```js
const cookie = useCookie(name, options)
```

::alert{icon=👉}
`useCookie` only works during `setup` or `Lifecycle Hooks`.
::

::alert{icon=😌}
`useCookie` ref will automatically serialize and deserialize cookie value to JSON.
::

::alert{icon=⚠️}
Multiple invocations of `useCookie` with the same name are not synced. [You can utilize `useState()` to sync them as a workaround](https://github.com/nuxt/nuxt/issues/13020#issuecomment-1505548242).
::

## Example

The example below creates a cookie called `counter`. If the cookie doesn't exist, it is initially set to a random value. When we update the `counter` variable, the cookie updates accordingly.

```vue
<template>
  <div>
    <h1>Counter: {{ counter || '-' }}</h1>
    <button @click="counter = null">reset</button>
    <button @click="counter--">-</button>
    <button @click="counter++">+</button>
  </div>
</template>

<script setup>
const counter = useCookie('counter')
counter.value = counter.value || Math.round(Math.random() * 1000)
</script>
```

:button-link[Open on StackBlitz]{href="https://stackblitz.com/github/nuxt/nuxt/tree/main/examples/composables/use-cookie?terminal=dev&file=app.vue" blank}

## Options

Cookie composable accepts several options which let you modify the behavior of cookies.

Most of the options will be directly passed to the [cookie](https://github.com/jshttp/cookie) package.

### `maxAge` / `expires`

**`maxAge`** Specifies the `number` (in seconds) to be the value for the [`Max-Age` `Set-Cookie` attribute](https://tools.ietf.org/html/rfc6265#section-5.2.2).
It will get converted to an integer by rounding down. By default, there is no maximum age.

**`expires`**: Specifies the `Date` object value for the [`Expires` attribute](https://tools.ietf.org/html/rfc6265#section-5.2.1).
By default, there is no expiration set. Most clients will consider this a "non-persistent cookie" and
will delete it on a condition like exiting a web browser application.

::alert{icon=💡}
**Note:** The [cookie storage model specification](https://tools.ietf.org/html/rfc6265#section-5.3) states that if both `expires` and `maxAge` is set, then `maxAge` takes precedence, but not all clients may obey this, so if both are present, they should point to the same date and time!
::

::alert
If neither `expires` nor `maxAge` is set, the cookie will be session-only and removed when the user closes their browser.
::

### `httpOnly`

Specifies the value of the [`HttpOnly` attribute](https://tools.ietf.org/html/rfc6265#section-5.2.6), a `boolean`. When truthy, it is set; otherwise, it is not. By default, it is not set.

::alert{icon=💡}
**Note:** Be careful when setting this to `true` as compliant clients will not allow client-side JavaScript to see the cookie in `document.cookie`.
::

### `secure`

Specifies the value of the [`Secure` attribute](https://tools.ietf.org/html/rfc6265#section-5.2.5), a `boolean`. When truthy, it is set; otherwise, it is not. By default, it is not set.

::alert{icon=💡}
**Note:** Be careful when setting this to `true`, as compliant clients will not send the cookie back to the server in the future if the browser does not have an HTTPS connection. This can lead to hydration errors.
::

### `domain`

Specifies the value of the [`Domain` attribute](https://tools.ietf.org/html/rfc6265#section-5.2.3). By default, no
domain is set, and most clients will consider applying the cookie only to the current one.

### `path`

Specifies the value of the [`Path` attribute](https://tools.ietf.org/html/rfc6265#section-5.2.4). By default, the path
is considered the ["default path"](https://tools.ietf.org/html/rfc6265#section-5.1.4).

### `sameSite`

Specifies the value of the [`SameSite` attribute](https://tools.ietf.org/html/draft-ietf-httpbis-rfc6265bis-03#section-4.1.2.7), a `boolean` or a `string`.

- `true` will set the `SameSite` attribute to `Strict` for strict same-site enforcement.
- `false` will not set the `SameSite` attribute.
- `'lax'` will set the `SameSite` attribute to `Lax` for lax same-site enforcement.
- `'none'` will set the `SameSite` attribute to `None` for an explicit cross-site cookie.
- `'strict'` will set the `SameSite` attribute to `Strict` for strict same-site enforcement.

More information about the different enforcement levels can be found in [the specification](https://tools.ietf.org/html/draft-ietf-httpbis-rfc6265bis-03#section-4.1.2.7).

### `encode`

Specifies a function for encoding a cookie's value. Since the value of a cookie has a limited character set (and must be a simple string), it can encode a value into a string suited for a cookie's value.

The default encoder is the `JSON.stringify` + `encodeURIComponent`.

### `decode`

Specifies a function to use for decoding a cookie's value. Since the value of a cookie has a limited character set (and must be a simple string), it can decode an encoded cookie value into a JavaScript string or another object.

The default decoder is `decodeURIComponent` + [destr](https://github.com/unjs/destr).

::alert{icon=💡}
**Note:** If an error gets thrown from this function, the original, non-decoded cookie value will
be returned as the cookie's value.
::

### `default`

Specifies a function that returns the cookie's default value. It can also return a `Ref`.

### `watch`

Specifies the [watch](https://vuejs.org/api/reactivity-core.html#watch) cookie ref data value, a `boolean` or a `string`.

- `true` - Will watch cookie ref data changes and its nested properties. (default)
- `shallow` - Will watch cookie ref data changes for only top-level properties
- `false` Will not watch cookie ref data changes.

**Example 1:**

```vue
<template>
  <div>User score: {{ user?.score }}</div>
</template>

<script setup>
const user = useCookie(
  'userInfo',
  {
    default: () => ({ score: -1 }),
    watch: false
  }
)

if (user.value && user.value !== null) {
  user.value.score++; // userInfo cookie not update with this change
}
</script>
```

**Example 2:**

```vue
<template>
  <div>
    <h1>List</h1>
    <pre>{{ list }}</pre>
    <button @click="add">Add</button>
    <button @click="save">Save</button>
  </div>
</template>

<script setup>
const list = useCookie(
  'list',
  {
    default: () => [],
    watch: 'shallow'
  }
)

function add() {
  list.value?.push(Math.round(Math.random() * 1000))
  // List cookie, not updated with this change
}

function save() {
  if (list.value && list.value !== null) {
    list.value = [...list.value]
    //List cookie, updated with this change
  }
}
</script>
```

## Handling Cookies in API Routes

You can use the `getCookie` and `setCookie` functions from the [`h3`](https://github.com/unjs/h3) package to set cookies in server API routes.

**Example:**

```js
export default defineEventHandler(event => {
  // Read counter cookie
  let counter = getCookie(event, 'counter') || 0

  // Increase counter cookie by 1
  setCookie(event, 'counter', ++counter)

  // Send JSON response
  return { counter }
})
```

::LinkExample{link="/docs/examples/composables/use-cookie"}
::
