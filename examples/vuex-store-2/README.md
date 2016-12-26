# Nuxt.js with Vuex

> Using a store to manage the state is important to every big application, that's why nuxt.js implement Vuex in its core.

## Activating the store

Nuxt.js will try to `require('./store/index.js')`, if exists, it will import `Vuex`, add it to the vendors and add the `store` option to the root `Vue` instance.

## Create the store folder

Let's create a file `store/index.js`:

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

> We don't need to install `Vuex` since it's shipped with nuxt.js

## Voilà !

We can now use `this.$store` inside our `.vue` files.

```html
<template>
  <button @click="$store.commit('increment')">{{ $store.state.counter }}</button>
</template>
```

## fetch (context)

> Used to fill the store before rendering the page

The `fetch` method, *if set*, is called every time before loading the component (*only if attached to a route*). It can be called from the server-side or before navigating to the corresponding route.

The `fetch` method receives the context as the first argument, we can use it to fetch some data and fill the store. To make the fetch method asynchronous, **return a Promise**, nuxt.js will wait for the promise to be resolved before rendering the Component.

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

## Context

To see the list of available keys in `context`, take a look at [this documentation](https://github.com/nuxt/nuxt.js/tree/master/examples/async-data#context).

## Action `nuxtServerInit`

If we define the action `nuxtServerInit` in our store, Nuxt.js will call it with the context. It can be useful when having some data on the server we want to give directly to the client-side, for example, the authenticated user:
```js
// store/index.js
actions: {
  nuxtServerInit ({ commit }, { req }) {
    if (req.authUser) {
      commit('user', req.authUser)
    }
  }
}
```

The context given to `nuxtServerInit` is the same as the `data` of `fetch` method except `context.redirect()` and `context.error()` are omitted.
