# `navigateTo`

`navigateTo` is a router helper function that allows creating programmatic navigation for users to navigate within Nuxt application.

`navigateTo` is available on both server side and client side. It can be used within plugins, middleware or can be called directly to perform page navigation.

## Usage

```ts
navigateTo (route: string | Route, { redirectCode = 302, replace = false })
```

`route` can be a plain string or a route object to redirect to.

::alert{type="warning"}
Make sure to use always `await` or `return` on result of `navigateTo()` when calling it.
::

## Examples

### Within a Vue Component

```vue
<script setup>
// string
return navigateTo('/search')

// route object
return navigateTo({ path: '/search' })

// route object with query parameters
return navigateTo({
    path: '/search',
    query: {
        name: name.value,
        type: type.value
    }
})
</script>
```

### Within Route Middleware

```js
export default defineNuxtRouteMiddleware((to, from) => {
  // set the redirect code to 301 Moved Permanently
  return navigateTo('/search', { redirectCode: 301 })
})
```

```js
<script setup>
    await navigateTo('/', { replace: true })
</script>
```

::ReadMore{link="/guide/directory-structure/middleware"}
::

### Options

#### `redirectCode`

- Type: Number

`navigateTo` redirects to the given path and sets the redirect code to [`302` Found](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/302) by default when the redirect takes place on the server side.

This default behavior can be modified by providing different `redirectCode` as an optional parameter. Commonly [`301` Moved Permanently](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/301) can be used for permant redirections.

#### `replace`

- Type: Boolean

By default, `navigateTo` pushes the given route into Vue router instance on client-side.

This behavior can be changed by setting `replace` to `true`, to indicate that given route should be replaced.
