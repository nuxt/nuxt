---
title: "preloadRouteComponents"
---

# `preloadRouteComponents`

`preloadRouteComponents` allows you to manually preload individual pages in your Nuxt app.

> Preloading routes loads the components of a given route that the user might navigate to in future. This ensures that the components are available earlier and less likely to block the navigation, improving performance.

::alert
Nuxt already automatically preloads the necessary routes if you're using the `NuxtLink` component.
::
::ReadMore{link="/docs/api/components/nuxt-link"}
::

## Example

Preload a route when using `navigateTo`.

```ts
// we don't await this async function, to avoid blocking rendering
// this component's setup function
preloadRouteComponents('/dashboard')

const submit = async () => {
  const results = await $fetch('/api/authentication')

  if (results.token) {
    await navigateTo('/dashboard')
  }
}
```

::ReadMore{link="/docs/api/composables/navigate-to"}
::

::alert{icon=👉}
Currently, on server, `preloadRouteComponents` will have no effect.
::
