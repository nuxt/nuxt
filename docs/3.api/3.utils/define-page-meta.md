---
title: "definePageMeta"
---

# `definePageMeta`

`definePageMeta` is a compiler macro that you can use to set metadata for your **page** components located in the `pages/` directory (unless [set otherwise](/docs/api/configuration/nuxt-config#pages)). This way, you can set custom metadata for each static or dynamic route of your Nuxt application.

```vue [pages/some-page.vue]
<script setup>
  definePageMeta({
    layout: 'default'
  })
</script>
```

::ReadMore{link="/docs/guide/directory-structure/pages/#page-metadata"}
::

## Type

```ts
definePageMeta(meta: PageMeta) => void

interface PageMeta {
  validate?: (route: RouteLocationNormalized) => boolean | Promise<boolean> | Partial<NuxtError> | Promise<Partial<NuxtError>>
  redirect?: RouteRecordRedirectOption
  alias?: string | string[]
  pageTransition?: boolean | TransitionProps
  layoutTransition?: boolean | TransitionProps
  key?: false | string | ((route: RouteLocationNormalizedLoaded) => string)
  keepalive?: boolean | KeepAliveProps
  layout?: false | LayoutKey | Ref<LayoutKey> | ComputedRef<LayoutKey>
  middleware?: MiddlewareKey | NavigationGuard | Array<MiddlewareKey | NavigationGuard>
  [key: string]: any
}
```

## Parameters

### `meta`

- **Type**: `PageMeta`

  An object accepting the following page metadata:

  **`alias`**

  - **Type**: `string | string[]`

    Aliases for the record. Allows defining paths that will behave like a copy of it. Allows having path shorthands like `/users/:id` and `/u/:id`. All `alias` and `path` values must share the same params.

  **`keepalive`**

  - **Type**: `boolean` | [`KeepAliveProps`](https://vuejs.org/api/built-in-components.html#keepalive)

    Set to `true` to preserve page state across route changes or use the [`KeepAliveProps`](https://vuejs.org/api/built-in-components.html#keepalive) for fine-grained control.

  **`key`**

  - **Type**: `false` | `string` | `((route: RouteLocationNormalizedLoaded) => string)`

    Set the `key` value when you need more control when the `<NuxtPage>` component is re-rendered.

  **`layout`**

  - **Type**: `false` | `LayoutKey` | `Ref<LayoutKey>` | `ComputedRef<LayoutKey>`

    Set a static or dynamic name for the layout for each route. This can be set to `false` if the default layout needs to be disabled.

  **`layoutTransition`**

  - **Type**: `boolean` | [`TransitionProps`](https://vuejs.org/api/built-in-components.html#transition)

    Set the name of the transition to apply to the current layout. You can also set this value to `false` to disable the layout transition.

  **`middleware`**

  - **Type**: `MiddlewareKey` | [`NavigationGuard`](https://router.vuejs.org/api/interfaces/NavigationGuard.html#navigationguard) | `Array<MiddlewareKey | NavigationGuard>`

    Define anonymous or named middleware directly within `definePageMeta`. Learn more about [route middleware](/docs/guide/directory-structure/middleware).

  **`pageTransition`**

  - **Type**: `boolean` | [`TransitionProps`](https://vuejs.org/api/built-in-components.html#transition)

    Set the name of the transition to apply for the current page. You can also set this value to `false` to disable the page transition.

  **`redirect`**

  - **Type**: [`RouteRecordRedirectOption`](https://router.vuejs.org/guide/essentials/redirect-and-alias.html#redirect-and-alias)

    Where to redirect if the route matched directly. The redirection happens before any navigation guard and triggers a new navigation with the new target location.

  **`validate`**

  - **Type**: `(route: RouteLocationNormalized) => boolean | Promise<boolean> | Partial<NuxtError> | Promise<Partial<NuxtError>>`

    Validate whether a route is renderable validly with this page. Return true if it is valid or false if not. With no other match, this will mean a 404. You can also directly return an object with `statusCode`/`statusMessage` to respond immediately with an error, causing other matches to get ignored.

  **`[key: string]`**

  - **Type**: `any`

    Apart from the above properties, you can set **custom** metadata. You may wish to do so safely by [augmenting the type of the `meta` object](/docs/guide/directory-structure/pages/#typing-custom-metadata).

## Examples

### Basic Usage

The example below demonstrates:

- how `key` can be a function that returns a value;
- how the `keepalive` property makes sure that the `<modal>` component is not cached when switching between components;
- adding `pageType` as a custom property:

```vue [pages/some-page.vue]
<script setup>
  definePageMeta({
    key: (route) => route.fullPath,

    keepalive: {
      exclude: ['modal']
    },

    pageType: 'Checkout'
  })
</script>
```

### Defining Middleware

The example below shows how the middleware can be defined using a `function` directly within the `definePageMeta` or set as a `string` that matches the middleware file name located in the `middleware/` directory:

```vue [pages/some-page.vue]
<script setup>
  definePageMeta({
    //Define middleware as a function
    middleware: [
      function (to, from) {
        const auth = useState('auth')

        if (!auth.value.authenticated) {
            return navigateTo('/login')
        }

        if (to.path !== '/checkout') {
          return navigateTo('/checkout')
        }
      }
    ],

    // ... or a string
    middleware: 'auth'

    // ... or multiple strings
    middleware: ['auth', 'another-named-middleware']
})
</script>
```

### Defining Layout

You can define a layout that matches its file name located (by default) in the `layouts/` directory. You can also disable it by setting the `layout` to `false`:

```vue [pages/some-page.vue]
<script setup>
  definePageMeta({
    //Set custom layout
    layout: 'admin'

    // ... or disable a default layout
    layout: false
  })
</script>
```
