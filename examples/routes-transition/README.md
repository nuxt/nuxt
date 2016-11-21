# Routes transitions with Nuxt.js

> Nuxt.js uses the  [`<transition>`](http://vuejs.org/v2/guide/transitions.html#Transitioning-Single-Elements-Components) component to allow you to create amazing transitions between your routes.

## Usage

🎬 [Demonstration video]()

The default transition name Nuxt.js uses is `page`.

To add a fade transition to every page of your application, we need a CSS file that is shared across all our routes, so we start by creating a file in the `assets/` folder.

`assets/main.css`:
```css
.page-enter-active, .page-leave-active {
  transition: opacity .5s
}
.page-enter, .page-leave-active {
  opacity: 0
}
```

We add it in our `nuxt.config.js` file:
```js
module.exports = {
  css: [
    'assets/main.css'
  ]
}
```

And voilà! A nice fade animation will be shown between every routes.

## The `transition` key

You can update the defaults transition settings by adding the `transition` key in you `nuxt.config.js` file.

```js
module.exports = {
  transition: 'test'
  // or
  transition: {
    name: 'test',
    mode: 'out-in'
  }
}
```

Nuxt.js will use these settings to set the component as follows:
```html
<transition name="test" mode="out-in">
```

To learn more about the Vue.js `<transition>` component: http://vuejs.org/v2/guide/transitions.html

The following properties that the `transition` key can have:

| key  | Default | definition |
|------|------------|-----------|
| `name` | `page` | The transition name applied on all the routes transitions. |
| `mode` | `out-in` | The transition mode applied on all routes, see [Vue.js documentation](http://vuejs.org/v2/guide/transitions.html#Transition-Modes). |

*Note: if the `transition` key is set as a string, it will be used as the `transition.name`.*

## Custom transition on a specific route

To define a custom transition for a specific route, simply add the `transition` key to the page component:

`pages/about.vue`:
```html
<template>
  <div class="container">
    <h1>About page</h1>
    <router-link to="/">Home page</router-link>
  </div>
</template>

<script>
export default {
  transition: 'bounce'
}
</script>
```

And then we add the CSS animation for this custom transition:
```css
/* assets/main.css */
.bounce-enter-active {
  animation: bounce-in .8s;
}
.bounce-leave-active {
  animation: bounce-out .5s;
}
@keyframes bounce-in {
  0% { transform: scale(0) }
  50% { transform: scale(1.5) }
  100% { transform: scale(1) }
}
@keyframes bounce-out {
  0% { transform: scale(1) }
  50% { transform: scale(1.5) }
  100% { transform: scale(0) }
}
```

*Note: you can also the set `transition` key as an object in page components*

## Demo

```bash
npm install
npm start
```

Go to [http://localhost:3000](http://localhost:3000) and navigate through the pages.
