# Custom loading with Nuxt.js

> Nuxt.js uses it's own component to show a progress bar between the routes. You can customize it, disable it or create your own component.

## Disable Nuxt.js progress bar

If you don't want to display the progress bar between the routes, just add `loading: false` in your `nuxt.config.js` file:
```js
// nuxt.config.js
module.exports = {
  loading: false
}
```

## Customize Nuxt.js progress bar

Here are the properties you can customize for Nuxt.js progress bar.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `color` | String | `'black'` | CSS color of the progress bar |
| `failedColor` | String | `'red'` | CSS color of the progress bar when an error appended during rendering the route (if `data` or `fetch` sent back an error for example). |
| `height` | String | `'2px'` | Height of the progress bar (used in the `style` property of the progress bar) |
| `duration` | Number | `5000` | In ms, the maximum duration of the progress bar, Nuxt.js assumes that the route will be rendered before 5 seconds. |

Example:
```js
// nuxt.config.js
module.exports = {
  loading: {
    color: 'blue',
    height: '5px'
  }
}
```

## Create a custom loading component

You can create your own component that Nuxt.js will call instead of its default component. To do so, you need to give a path to your component in the `loading` option.

Your custom component will be called by Nuxt.js, so make sure your component exposes some of theses methods:

| Method | Required | Description |
|--------|-------------|
| `start()` | Required | Called when a route changes, this is here where you should show your component. |
| `finish()` | Required | Called when a route is loaded (and data fetched), this is here where you should hide your component. |
| `fail()` | *Optional* | Called when a route could not be loaded (failed to fetch data for example). |
| `increase(num)` | *Optional* | Called during loading the route component, `num` is an Integer < 100. |


Example:
```js
// nuxt.config.js
module.exports = {
  loading: 'components/loading.vue'
}
```

And then, in `components/loading.vue`:
```html
<template lang="html">
  <div class="loading-page" v-if="loading">
    <p>Loading...</p>
  </div>
</template>

<script>
export default {
  data: () => ({
    loading: false
  }),
  methods: {
    start () {
      this.loading = true
    },
    finish () {
      this.loading = false
    }
  }
}
</script>

<style scoped>
.loading-page {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.8);
  text-align: center;
  padding-top: 200px;
  font-size: 30px;
  font-family: sans-serif;
}
</style>
```

## Demo

```bash
npm install
npm start
```

Go to [http://localhost:3000](http://localhost:3000) and navigate trough the app.
