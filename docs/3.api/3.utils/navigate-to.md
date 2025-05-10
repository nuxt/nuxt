---
title: "navigateTo"
description: navigateTo is a helper function that programmatically navigates users.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/router.ts
    size: xs
---

## Usage

`navigateTo` is available on both server side and client side. It can be used within the [Nuxt context](/docs/guide/going-further/nuxt-app#the-nuxt-context), or directly, to perform page navigation.

::warning
Make sure to always use `await` or `return` on result of `navigateTo` when calling it.
::

::note
`navigateTo` cannot be used within Nitro routes. To perform a server-side redirect in Nitro routes, use [`sendRedirect`](https://h3.dev/utils/response#sendredirectevent-location-code) instead.
::

### Within a Vue Component

```vue
<script setup lang="ts">
// passing 'to' as a string
await navigateTo('/search')

// ... or as a route object
await navigateTo({ path: '/search' })

// ... or as a route object with query parameters
await navigateTo({
  path: '/search',
  query: {
    page: 1,
    sort: 'asc'
  }
})
</script>
```

### Within Route Middleware

```ts
export default defineNuxtRouteMiddleware((to, from) => {
  if (to.path !== '/search') {
    // setting the redirect code to '301 Moved Permanently'
    return navigateTo('/search', { redirectCode: 301 })
  }
})
```

When using `navigateTo` within route middleware, you must **return its result** to ensure the middleware execution flow works correctly.

For example, the following implementation **will not work as expected**:

```ts
export default defineNuxtRouteMiddleware((to, from) => {
  if (to.path !== '/search') {
    // ❌ This will not work as expected
    navigateTo('/search', { redirectCode: 301 })
    return
  }
})
```

In this case, `navigateTo` will be executed but not returned, which may lead to unexpected behavior.

:read-more{to="/docs/guide/directory-structure/middleware"}

### Navigating to an External URL

The `external` parameter in `navigateTo` influences how navigating to URLs is handled:

- **Without `external: true`**:
  - Internal URLs navigate as expected.
  - External URLs throw an error.

- **With `external: true`**:
  - Internal URLs navigate with a full-page reload.
  - External URLs navigate as expected.

#### Example

```vue
<script setup lang="ts">
// will throw an error;
// navigating to an external URL is not allowed by default
await navigateTo('https://nuxt.com')

// will redirect successfully with the 'external' parameter set to 'true'
await navigateTo('https://nuxt.com', {
  external: true
})
</script>
```

### Opening a Page in a New Tab

```vue
<script setup lang="ts">
// will open 'https://nuxt.com' in a new tab
await navigateTo('https://nuxt.com', {
  open: {
    target: '_blank',
    windowFeatures: {
      width: 500,
      height: 500
    }
  }
})
</script>
```

## Type

```ts
function navigateTo(
  to: RouteLocationRaw | undefined | null,
  options?: NavigateToOptions
) => Promise<void | NavigationFailure | false> | false | void | RouteLocationRaw 

interface NavigateToOptions {
  replace?: boolean
  redirectCode?: number
  external?: boolean
  open?: OpenOptions
}

type OpenOptions = {
  target: string
  windowFeatures?: OpenWindowFeatures
}

type OpenWindowFeatures = {
  popup?: boolean
  noopener?: boolean
  noreferrer?: boolean
} & XOR<{ width?: number }, { innerWidth?: number }>
  & XOR<{ height?: number }, { innerHeight?: number }>
  & XOR<{ left?: number }, { screenX?: number }>
  & XOR<{ top?: number }, { screenY?: number }>
```

## Parameters

### `to`

**Type**: [`RouteLocationRaw`](https://router.vuejs.org/api/interfaces/RouteLocationOptions.html#Interface-RouteLocationOptions) | `undefined` | `null`

**Default**: `'/'`

`to` can be a plain string or a route object to redirect to. When passed as `undefined` or `null`, it will default to `'/'`.

#### Example

```ts
// Passing the URL directly will redirect to the '/blog' page
await navigateTo('/blog')

// Using the route object, will redirect to the route with the name 'blog'
await navigateTo({ name: 'blog' })

// Redirects to the 'product' route while passing a parameter (id = 1) using the route object.
await navigateTo({ name: 'product', params: { id: 1 } })
```

### `options` (optional)

**Type**: `NavigateToOptions`

An object accepting the following properties:

- `replace`

  - **Type**: `boolean`
  - **Default**: `false`
  - By default, `navigateTo` pushes the given route into the Vue Router's instance on the client side.

    This behavior can be changed by setting `replace` to `true`, to indicate that given route should be replaced.

- `redirectCode`

  - **Type**: `number`
  - **Default**: `302`

  - `navigateTo` redirects to the given path and sets the redirect code to [`302 Found`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/302) by default when the redirection takes place on the server side.

    This default behavior can be modified by providing different `redirectCode`. Commonly, [`301 Moved Permanently`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/301) can be used for permanent redirections.

- `external`

  - **Type**: `boolean`
  - **Default**: `false`

  - Allows navigating to an external URL when set to `true`. Otherwise, `navigateTo` will throw an error, as external navigation is not allowed by default.

- `open`

  - **Type**: `OpenOptions`
  - Allows navigating to the URL using the [open()](https://developer.mozilla.org/en-US/docs/Web/API/Window/open) method of the window. This option is only applicable on the client side and will be ignored on the server side.

    An object accepting the following properties:

  - `target`

    - **Type**: `string`
    - **Default**: `'_blank'`

    - A string, without whitespace, specifying the name of the browsing context the resource is being loaded into.

  - `windowFeatures`

    - **Type**: `OpenWindowFeatures`

    - An object accepting the following properties:

      | Property | Type    | Description |
      |----------|---------|--------------|
      | `popup`  | `boolean` | Requests a minimal popup window instead of a new tab, with UI features decided by the browser. |
      | `width` or `innerWidth`  | `number`  | Specifies the content area's width (minimum 100 pixels), including scrollbars. |
      | `height` or `innerHeight` | `number`  | Specifies the content area's height (minimum 100 pixels), including scrollbars. |
      | `left` or `screenX`   | `number`  | Sets the horizontal position of the new window relative to the left edge of the screen. |
      | `top` or `screenY`   | `number`  | Sets the vertical position of the new window relative to the top edge of the screen. |
      | `noopener` | `boolean` | Prevents the new window from accessing the originating window via `window.opener`. |
      | `noreferrer` | `boolean` | Prevents the Referer header from being sent and implicitly enables `noopener`. |

      Refer to the [documentation](https://developer.mozilla.org/en-US/docs/Web/API/Window/open#windowfeatures) for more detailed information on the **windowFeatures** properties.
