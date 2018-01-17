# `<keep-alive>` with Nuxt.js

Introduced in v1.2.0, you can add the `keep-alive` prop to `<nuxt/>` or `<nuxt-child/>` to "keep alive" the pages.

`layouts/default.vue`:

```vue
<template>
  <nuxt keep-alive/>
</template>
```
