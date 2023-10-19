---
title: "useRouter"
description: "The useRouter composable returns the router instance."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/router.ts
    size: xs
---

```vue [pages/index.vue]
<script setup>
const router = useRouter()
</script>
```

If you only need the router instance within your template, use `$router`:

```vue [pages/index.vue]
<template>
  <button @click="$router.back()">Back</button>
</template>
```

If you have a `pages/` directory, `useRouter` is identical in behavior to the one provided by `vue-router`.

::read-more{icon="i-simple-icons-vuedotjs" to="https://router.vuejs.org/api/interfaces/Router.html#Properties-currentRoute" target="_blank"}
Read `vue-router` documentation about the `Router` interface.
::

## Basic Manipulation

- [`addRoute()`](https://router.vuejs.org/api/interfaces/Router.html#addRoute): Add a new route to the router instance. `parentName` can be provided to add new route as the child of an existing route.
- [`removeRoute()`](https://router.vuejs.org/api/interfaces/Router.html#removeRoute): Remove an existing route by its name.
- [`getRoutes()`](https://router.vuejs.org/api/interfaces/Router.html#getRoutes): Get a full list of all the route records.
- [`hasRoute()`](https://router.vuejs.org/api/interfaces/Router.html#hasRoute): Checks if a route with a given name exists.
- [`resolve()`](https://router.vuejs.org/api/interfaces/Router.html#resolve): Returns the normalized version of a route location. Also includes an `href` property that includes any existing base.

```ts [Example]
const router = useRouter()

router.addRoute({ name: 'home', path: '/home', component: Home })
router.removeRoute('home')
router.getRoutes()
router.hasRoute('home')
router.resolve({ name: 'home' })
```

::callout
`router.addRoute()` adds route details into an array of routes and it is useful while building [Nuxt plugins](/docs/guide/directory-structure/plugins) while `router.push()` on the other hand, triggers a new navigation immediately and it is useful in pages, Vue components and composable.
::

## Based on History API

- [`back()`](https://router.vuejs.org/api/interfaces/Router.html#back): Go back in history if possible, same as `router.go(-1)`.
- [`forward()`](https://router.vuejs.org/api/interfaces/Router.html#forward): Go forward in history if possible, same as `router.go(1)`.
- [`go()`](https://router.vuejs.org/api/interfaces/Router.html#go): Move forward or backward through the history without the hierarchical restrictions enforced in `router.back()` and `router.forward()`.
- [`push()`](https://router.vuejs.org/api/interfaces/Router.html#push): Programmatically navigate to a new URL by pushing an entry in the history stack. **It is recommended to use [`navigateTo`](/docs/api/utils/navigate-to) instead.**
- [`replace()`](https://router.vuejs.org/api/interfaces/Router.html#replace): Programmatically navigate to a new URL by replacing the current entry in the routes history stack. **It is recommended to use [`navigateTo`](/docs/api/utils/navigate-to) instead.**

```ts [Example]
const router = useRouter()

router.back()
router.forward()
router.go(3)
router.push({ path: "/home" })
router.replace({ hash: "#bio" })
```

::read-more{icon="i-simple-icons-mdnwebdocs" color="gray" to="https://developer.mozilla.org/en-US/docs/Web/API/History" target="_blank"}
Read more about the browser's History API.
::

## Navigation Guards

`useRouter` composable provides `afterEach`, `beforeEach` and `beforeResolve` helper methods that acts as navigation guards.

However, Nuxt has a concept of **route middleware** that simplifies the implementation of navigation guards and provides a better developer experience.

:read-more{to="/docs/guide/directory-structure/middleware"}

## Promise and Error Handling

- [`isReady()`](https://router.vuejs.org/api/interfaces/Router.html#isReady): Returns a Promise that resolves when the router has completed the initial navigation.
- [`onError`](https://router.vuejs.org/api/interfaces/Router.html#onError): Adds an error handler that is called every time a non caught error happens during navigation.

:read-more{icon="i-simple-icons-vuedotjs" to="https://router.vuejs.org/api/interfaces/Router.html#Methods" title="Vue Router Docs" target="_blank"}

## Universal Router Instance

If you do not have a `pages/` folder, then [`useRouter`](/docs/api/composables/use-router)  will return a universal router instance with similar helper methods, but be aware that not all features may be supported or behave in exactly the same way as with `vue-router`.
