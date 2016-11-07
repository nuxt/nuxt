# Nuxt.js with Vuex

> Using a store to manage the state is important to every big application, that's why nuxt.js implement Vuex in its core.

## Activate the store option

First, we need to tell nuxt.js to activate the store, for this, we add a `nuxt.config.js` file:

```js
module.exports = {
  store: true
}
```

## Create the store folder

When the store option is activated, nuxt will import it via `require('./store')`

After creating the `store/` folder, we can create our `store/index.js` file:

```js
import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

const store = new Vuex.Store({
  state: {
    counter: 0
  },
  mutations: {
    increment (state) {
      state.counter++
    }
  }
})

export default store
```

> You don't need to install vuex since it's shipped with nuxt.js

## Voilà !

You're ready to use `this.$store` inside your `.vue` files :)

```html
<template>
  <button @click="$store.commit('increment')">{{ $store.state.counter }}</button>
</template>
```

## fetch(context)

> Used to fill the store before rendering the page

The `fetch` method, *if set*, is called every time before loading the component (*only if attached to a route*). It can be called from the server-side or before navigating to the corresponding route.

The `fetch` method receives the context as the first argument, you can use it to fetch some data and fill the store. To make the fetch method asynchronous, **return a Promise**, nuxt.js will wait for the promise to be resolved before rendering the Component.

For example:
```js
export default {
  fetch ({ store, params }) {
    return axios.get('http://my-url')
    .then((res) => {
      store.commit('setUser', res.data)
    })
  }
}
```
