# Layouts

> Nuxt.js allows you to extend the main layout or create custom layout by adding them in the `layouts/` directory

## layouts/default.vue

You can extend the main layout by adding a `layouts/default.vue` file.

*Make sure to add the `<nuxt>` component when creating a layout to display the page component.*

The default layout source code is:
```html
<template>
  <nuxt/>
</template>
```

## layouts/error.vue

You can customize the error page by adding a `layouts/error.vue` file.

This layout is special since your should not include `<nuxt/>` inside its template, see this layout as a component displayed when an error occurs (404, 500, etc).

The default error page source code is available on: https://github.com/nuxt/nuxt.js/blob/master/lib/app/components/nuxt-error.vue

## layouts/*.vue

See the [demonstration video](https://www.youtube.com/watch?v=YOKnSTp7d38).

Every file (*first level*) in the `layouts/` directory will create a custom layout accessible with the `layout` property in the page component.

*Make sure to add the `<nuxt>` component when creating a layout to display the page component.*

Example of `layouts/blog.vue`:
```html
<template>
  <div>
    <div>My blog navigation bar here</div>
    <nuxt/>
  </div>
</template>
```

And then in `pages/posts.vue` I can tell Nuxt.js to use this custom layout:
```html
<script>
export default {
  layout: 'blog'
}
</script>
```

## Demo

```bash
npm install
npm run dev
```

Go to [http://localhost:3000](http://localhost:3000) and navigate trough the app. To see the custom error page: [http://localhost:3000/404](http://localhost:3000/404)
