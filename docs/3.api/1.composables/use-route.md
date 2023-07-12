---
title: "useRoute"
description: The useRoute composable returns the current route.
---

# `useRoute`

The [`useRoute`](/docs/api/composables/use-route) composable returns the current route and must be called in a `setup` function, plugin, or route middleware.

Within the template of a Vue component, you can access the route using `$route`.

## Example

In the following example, we call an API via [`useFetch`](/docs/api/composables/use-fetch) using a dynamic page parameter - `slug` - as part of the URL.

```html [~/pages/[slug].vue]
<script setup>
const route = useRoute()
const { data: mountain } = await useFetch(`https://api.nuxtjs.dev/mountains/${route.params.slug}`)
</script>

<template>
  <div>
    <h1>{{ mountain.title }}</h1>
    <p>{{ mountain.description }}</p>
  </div>
</template>
```

If you need to access the route query parameters (for example `example` in the path `/test?example=true`), then you can use `useRoute().query` instead of `useRoute().params`.

Apart from dynamic parameters and query parameters, `useRoute()` also provides the following computed references related to the current route:

* **fullPath**: encoded URL associated with the current route that contains path, query and hash
* **hash**: decoded hash section of the URL that starts with a #
* **matched**: array of normalized matched routes with current route location
* **meta**: custom data attached to the record
* **name**: unique name for the route record
* **path**: encoded pathname section of the URL
* **redirectedFrom**: route location that was attempted to access before ending up on the current route location

::ReadMore{link="https://router.vuejs.org/api/interfaces/RouteLocationNormalizedLoaded.html"}
::
