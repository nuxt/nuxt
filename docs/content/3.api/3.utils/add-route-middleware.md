# `addRouteMiddleware`

`addRouteMiddleware()` is a helper function to dynamically add route middleware in your Nuxt application.

::alert{type=info}
Route middleware are navigation guards stored in the [`middleware/`](/guide/directory-structure/middleware) directory of your Nuxt application (unless [set otherwise](/api/configuration/nuxt.config#middleware)).
::

## Usage

```js
addRouteMiddleware (name: string | RouteMiddleware, middleware?: RouteMiddleware, options: AddRouteMiddlewareOptions = {})
```

`addRouteMiddleware()` takes three arguments:

- **name** `type: string | RouteMiddleware`

`name` can be either a string or a function of type `RouteMiddleware`. Function takes the next route `to` as the first argument and the current route `from` as the second argument, both of which are Vue route objects.

Learn more about available properties of [route objects](/api/composables/use-route).

- **middleware** `type: RouteMiddleware`

The second argument is a function of type `RouteMiddleware`. Same as above, it provides `to` and `from` route objects. It becomes optional if the first argument in `addRouteMiddleware()` is already passed as a function.

- **options** `type: AddRouteMiddlewareOptions`  

An optional `options` argument lets you set the value of `global` to `true` to indicate whether the router middleware is global or not (set to `false` by default).

## Examples

### Anonymous Route Middleware

Anonymous route middleware does not have a name. It takes a function as the first argument, making the second `middleware` argument redundant:

```ts [plugins/my-plugin.ts]
export default defineNuxtPlugin(() => {
  addRouteMiddleware((to, from) => {
    if (to.path === '/forbidden') {
      return false
    }
  })
})
```

### Named Route Middleware

Named route middleware takes a string as the first argument and a function as the second.

When defined in a plugin, it overrides any existing middleware of the same name located in the `middleware/` directory:

```ts [plugins/my-plugin.ts]
export default defineNuxtPlugin(() => {
  addRouteMiddleware('named-middleware', () => {
    console.log('named middleware added in Nuxt plugin')
  })
})
```

### Global Route Middleware

You can set an optional, third argument `{ global: true }` to indicate whether the route middleware is global:

```ts [plugins/my-plugin.ts]
export default defineNuxtPlugin(() => {
  addRouteMiddleware('global-middleware', (to, from) => {
      console.log('global middleware that runs on every route change')
    },
    { global: true }
  )
})
```
