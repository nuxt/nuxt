# Extending the main app

> Nuxt.js allows you to extend the main application by adding a `layouts/app.vue` file

## The default app

The default source code of the main app is:
```html
<template>
  <nuxt-container>
    <nuxt/>
  </nuxt-container>
</template>
```

## The `layouts/app.vue` file

### 🎬 [Example video](https://www.youtube.com/watch?v=wBhia7uBxDA)

You have to make sure to add the `<nuxt-container>` and `<nuxt>` components when extending the app.

It is important that the code you add stays inside `<nuxt-container>`.

Example:
```html
<template>
  <nuxt-container>
    <div>My navigation bar here</div>
    <nuxt/>
  </nuxt-container>
</template>
```

## Demo


```bash
npm install
npm start
```

Go to [http://localhost:3000](http://localhost:3000) and navigate trough the app. Notice how the logo at the top right stays between the pages, even on the error page: [http://localhost:3000/404](http://localhost:3000/404)
