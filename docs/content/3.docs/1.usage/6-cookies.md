# Cookies

> Nuxt provides SSR-friendly composable to read and write cookies.

## Usage

Within your pages, components, and plugins you can use `useCookie` to create a reactive reference bound to a specific cookie.

```js
const cookie = useCookie(name, options)
```

::alert{icon=👉}
**`useCookie` only works during `setup` or `Lifecycle Hooks`**
::

::alert{icon=😌}
`useCookie` ref will be automatically serialize and deserialized cookie value to JSON.
::

## Example

The example below creates a cookie called counter and if it doesn't exist set a random value. Whenever we update `counter`, the cookie will be updated.

```vue
<template>
  <div>
    <h1> Counter: {{ counter || '-' }}</h1>
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

<script setup>
const counter = useCookie('counter')
counter.value = counter.value || Math.round(Math.random() * 1000)
</script>
```

:button-link[Open on StackBlitz]{href="https://stackblitz.com/github/nuxt/framework/tree/main/examples/use-cookie?terminal=dev" blank}

## Options

Cookie composable accepts these properties in the options. Use them to modify the behavior of cookies.

Most of the options will be directly passed to [cookie](https://github.com/jshttp/cookie) package.

### `maxAge` / `expires`

**`maxAge`** Specifies the `number` (in seconds) to be the value for the [`Max-Age` `Set-Cookie` attribute](https://tools.ietf.org/html/rfc6265#section-5.2.2).
The given number will be converted to an integer by rounding down. By default, no maximum age is set.

**`expires`**: Specifies the `Date` object to be the value for the [`Expires` `Set-Cookie` attribute](https://tools.ietf.org/html/rfc6265#section-5.2.1).
By default, no expiration is set, and most clients will consider this a "non-persistent cookie" and
will delete it on a condition like exiting a web browser application.

::alert{icon=💡}
**Note:** The [cookie storage model specification](https://tools.ietf.org/html/rfc6265#section-5.3) states that if both `expires` and
`maxAge` are set, then `maxAge` takes precedence, but it is possible not all clients obey this,
so if both are set, they should point to the same date and time.eaks!
::

::alert
If neither of `expires` and `maxAge` are set, cookie will be session-only and removed if the user closes their browser.
::

#### `httpOnly`

Specifies the `boolean` value for the [`HttpOnly` `Set-Cookie` attribute](https://tools.ietf.org/html/rfc6265#section-5.2.6). When truthy,
the `HttpOnly` attribute is set, otherwise, it is not. By default, the `HttpOnly` attribute is not set.

::alert{icon=💡}
**Note** be careful when setting this to `true`, as compliant clients will not allow client-side
JavaScript to see the cookie in `document.cookie`.
::

#### `secure`

Specifies the `boolean` value for the [`Secure` `Set-Cookie` attribute](https://tools.ietf.org/html/rfc6265#section-5.2.5). When truthy,
the `Secure` attribute is set, otherwise,it is not. By default, the `Secure` attribute is not set.

::alert{icon=💡}
**Note:** be careful when setting this to `true`, as compliant clients will not send the cookie back to
the server in the future if the browser does not have an HTTPS connection. This can lead to hydration errors.
::

#### `domain`

Specifies the value for the [`Domain` `Set-Cookie` attribute](https://tools.ietf.org/html/rfc6265#section-5.2.3). By default, no
domain is set, and most clients will consider the cookie to apply to only the current domain.

#### `path`

Specifies the value for the [`Path` `Set-Cookie` attribute](https://tools.ietf.org/html/rfc6265#section-5.2.4). By default, the path
is considered the ["default path"](https://tools.ietf.org/html/rfc6265#section-5.1.4).

#### `sameSite`

Specifies the `boolean` or `string` to be the value for the [`SameSite` `Set-Cookie` attribute](https://tools.ietf.org/html/draft-ietf-httpbis-rfc6265bis-03#section-4.1.2.7).

- `true` will set the `SameSite` attribute to `Strict` for strict same site enforcement.
- `false` will not set the `SameSite` attribute.
- `'lax'` will set the `SameSite` attribute to `Lax` for lax same site enforcement.
- `'none'` will set the `SameSite` attribute to `None` for an explicit cross-site cookie.
- `'strict'` will set the `SameSite` attribute to `Strict` for strict same site enforcement.

More information about the different enforcement levels can be found in [the specification](https://tools.ietf.org/html/draft-ietf-httpbis-rfc6265bis-03#section-4.1.2.7).

#### `encode`

Specifies a function that will be used to encode a cookie's value. Since value of a cookie
has a limited character set (and must be a simple string), this function can be used to encode
a value into a string suited for a cookie's value.

The default encoder is the `JSON.stringify` + `encodeURIComponent`.

#### `decode`

Specifies a function that will be used to decode a cookie's value. Since the value of a cookie
has a limited character set (and must be a simple string), this function can be used to decode
a previously-encoded cookie value into a JavaScript string or other object.

The default decoder is `decodeURIComponent` + [destr](https://github.com/unjs/destr).

::alert{icon=💡}
**Note** if an error is thrown from this function, the original, non-decoded cookie value will
be returned as the cookie's value.
::

## Handling cookies in API routes

You can use `useCookie` and `setCookie` from [`h3`](https://github.com/unjs/h3) package to set cookies in server API routes.

**Example:**

```js
import { useCookie, setCookie } from 'h3'

export default (req, res) => {
 // Reat counter cookie
 let counter = useCookie(req, 'counter') || 0

 // Increase counter cookie by 1
 setCookie(res, 'counter', ++counter)

 // Send JSON response
 return { counter }
}
```
