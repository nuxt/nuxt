---
title: 'setPageLayout'
description: setPageLayout allows you to dynamically change the layout of a page.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/router.ts
    size: xs
---

::important
`setPageLayout` allows you to dynamically change the layout of a page. It relies on access to the Nuxt context and therefore can only be called within the [Nuxt context](/docs/4.x/guide/going-further/nuxt-app#the-nuxt-context).
::

```ts [app/middleware/custom-layout.ts]
export default defineNuxtRouteMiddleware((to) => {
  // Set the layout on the route you are navigating _to_
  setPageLayout('other')
})
```

## Passing Props to Layouts

You can pass props to the layout by providing an object as the second argument:

```ts [app/middleware/admin-layout.ts]
export default defineNuxtRouteMiddleware((to) => {
  setPageLayout('admin', {
    sidebar: true,
    title: 'Dashboard',
  })
})
```

The layout can then receive these props:

```vue [app/layouts/admin.vue]
<script setup lang="ts">
const props = defineProps<{
  sidebar?: boolean
  title?: string
}>()
</script>

<template>
  <div>
    <aside v-if="sidebar">Sidebar</aside>
    <main>
      <h1>{{ title }}</h1>
      <slot />
    </main>
  </div>
</template>
```

::note
If you choose to set the layout dynamically on the server side, you _must_ do so before the layout is rendered by Vue (that is, within a plugin or route middleware) to avoid a hydration mismatch.
::
