# `<keep-alive>` with Nuxt.js

Introduced in v1.2.0, you can add the `keep-alive` prop to `<Nuxt/>` or `<NuxtChild/>` to "keep alive" the pages.

`layouts/default.vue`:

```vue
<template>
  <Nuxt keep-alive/>
</template>
```

Screenshot:

![screen shot 2018-01-17 at 09 42 47](https://user-images.githubusercontent.com/904724/35033642-b41ec51c-fb6b-11e7-87cf-5617ade32841.png)
