# Using build.styleResources with Nuxt.js

This is useful when you need to inject some variables and mixins in your pages without having to import them every time.

Nuxt.js uses https://github.com/yenshih/style-resources-loader to achieve this behaviour.

You need to specify the patterns/path you want to include for the given pre-processors: `css`, `less`, `sass`, `scss` or `stylus`

:warning: You cannot use path aliases here (`~` and `@`), you need to use relative or absolute paths.

`nuxt.config.js`:

```js
{
  build: {
    styleResources: {
      scss: './assets/variables.scss',
      less: './assets/*.less',
      // sass: ...,
      // scss: ...
      options: {
        // See https://github.com/yenshih/style-resources-loader#options
        // Except `patterns` property
      }
    }
  }
}
```

:warning: If you want to use `@import` in these `styleResources` files, you should use path alias (`~@`) like this

```scss
@import '~@/assets/other.scss';
```

Then in your pages, you can use directly:

`pages/index.vue`

```vue
<template>
  <div class="main">
    <p>Page with SCSS</p>
    <p><NuxtLink to="/less">LESS</NuxtLink></p>
  </div>
</template>

<style lang="scss">
/* ~/assets/variables.scss is injected automatically here */
.main {
  background: $main;
}
</style>
```

Thanks to [0pt1m1z3r](https://github.com/0pt1m1z3r) for adding this feature and example.
