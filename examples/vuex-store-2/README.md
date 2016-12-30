# Nuxt.js with Vuex 2

> Using a store to manage the state is important to every big application, that's why nuxt.js implement Vuex in its core.

> Alternative way of creating a store modularly.

## Activating the store

Nuxt.js will look for the `./store/` directory, if it exists, its will import and use Vuex. If there is no `./store/index.js` file that returns a store, Nuxt.js will go through all files of the `./store/` directory and create a store with a module for each file (`./store/index.js` being "root" module).

## Create the store folder

Let's create a file `store/index.js`:

```js
export const state = { counter: 0 }

export const mutations = {
  increment (state) {
    state.counter++
  }
}
```

and
`store/todos.js`:

```js
export const state = {
  list: []
}

export const mutations = {
  add (state, { text }) {
    state.list.push({
      text,
      done: false
    })
  },

  delete (state, { todo }) {
    state.list.splice(state.list.indexOf(todo), 1)
  },

  toggle (state, { todo }) {
    todo.done = !todo.done
  }
}
```

> We don't need to install `Vuex` since it's shipped with nuxt.js

## Voilà !

We can now use `this.$store` inside our `.vue` files.

```html
<template>
  <button @click="$store.commit('increment')">{{ $store.state.counter }}</button>
</template>
```

The store will be as such:
```js
new Vuex.Store({
  state: { counter: 0 },
  mutations: {
    increment (state) {
      state.counter++
    }
  },
  modules: {
    todos: {
      state: {
        list: []
      },
      mutations: {
        add (state, { text }) {
          state.list.push({
            text,
            done: false
          })
        },
        delete (state, { todo }) {
          state.list.splice(state.list.indexOf(todo), 1)
        },
        toggle (state, { todo }) {
          todo.done = !todo.done
        }
      }
    }
  }
})
```
