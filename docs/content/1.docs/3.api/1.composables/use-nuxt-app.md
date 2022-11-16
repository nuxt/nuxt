# `useNuxtApp`

`useNuxtApp` is a built-in composable that provides a way to access shared runtime context of Nuxt, which is available on both client and server side. It helps you access the Vue app instance, runtime hooks, runtime config variables and internal states, such as `ssrContext` and `payload`.

You can use `useNuxtApp()` within composables, plugins and components.

```vue [app.vue]
<script setup>
  const nuxtApp = useNuxtApp()
</script>
```

## Methods

### `provide (name, value)`

`nuxtApp` is a runtime context that you can extend using [Nuxt plugins](https://v3.nuxtjs.org/guide/directory-structure/plugins). Use the `provide` function to create Nuxt plugins to make values and helper methods available in your Nuxt application across all composables and components.

`provide` function accepts `name` and `value` parameters.

**Example:**

```js
const nuxtApp = useNuxtApp()
nuxtApp.provide('hello', (name) => `Hello ${name}!`)

// Prints "Hello name!"
console.log(nuxtApp.$hello('name'))
```

As you can see in the example above, `$hello` has become the new and custom part of `nuxtApp` context and it is available in all places where `nuxtApp` is accessible.

### `hook(name, cb)`

Hooks available in `nuxtApp` allows you to customize the runtime aspects of your Nuxt application. You can use runtime hooks in Vue.js composables and [Nuxt plugins](/docs/guide/directory-structure/plugins) to hook into the rendering lifecycle.

`hook` function is useful for adding custom logic by hooking into the rendering lifecycle at a specific point. `hook` function is mostly used when creating Nuxt plugins.

See [Runtime Hooks](/docs/api/advanced/hooks#app-hooks-runtime) for available runtime hooks called by Nuxt.

```js [plugins/test.ts]
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('page:start', () => {
    /* your code goes here */
  })
  nuxtApp.hook('vue:error', (..._args) => {
    console.log('vue:error')
    // if (process.client) {
    //   console.log(..._args)
    // }
  })
})
```

### `callhook(name, ...args)`

`callHook` returns a promise when called with any of the existing hooks.

```js
await nuxtApp.callHook('my-plugin:init')
```

## Properties

`useNuxtApp()` exposes the following properties that you can use to extend and customize your app and share state, data and variables.

### `vueApp`

`vueApp` is the global Vue.js [application instance](https://vuejs.org/api/application.html#application-api) that you can access through `nuxtApp`. Some useful methods:

- [**component()**](https://vuejs.org/api/application.html#app-component) - Registers a global component if passing both a name string and a component definition, or retrieves an already registered one if only the name is passed.
- [**directive()**](https://vuejs.org/api/application.html#app-directive) - Registers a global custom directive if passing both a name string and a directive definition, or retrieves an already registered one if only the name is passed[(example)](https://v3.nuxtjs.org/guide/directory-structure/plugins#vue-directives).
- [**use()**](https://vuejs.org/api/application.html#app-use) - Installs a **[Vue.js Plugin](https://vuejs.org/guide/reusability/plugins.html)** [(example)](https://v3.nuxtjs.org/guide/directory-structure/plugins#vue-plugins).

:ReadMore{link="https://vuejs.org/api/application.html#application-api"}

### `ssrContext`

`ssrContext` is generated during server-side rendering and it is only available on the server side. Nuxt exposes the following properties through `ssrContext`:

- **`url`** (string) -  Current request url.
- **`event`** ([unjs/h3](https://github.com/unjs/h3) request event) - Access to `req` and `res` objects for the current request.
- **`payload`** (object) - NuxtApp payload object.

### `payload`

`payload` exposes data and state variables from server side to client side and makes them available in the `window.__NUXT__` object that is accessible from the browser.

`payload` exposes the following keys on the client side after they are stringified and passed from the server side:

- **serverRendered** (boolean) - Indicates if response is server-side-rendered.
- **data** (object) - When you fetch the data from an API endpoint using either `useFetch` or `useAsyncData`, resulting payload can be accessed from the `payload.data`. This data is cached and helps you prevent fetching the same data in case an identical request is made more than once.

```vue [app.vue]
export default defineComponent({
  async setup() {
    const { data } = await useAsyncData('count', () => $fetch('/api/count'))
  }
})
```

After fetching the value of `count` using `useAsyncData` in the example above, if you access `payload.data`, you will see `{ count: 1 }` recorded there. The value of `count` is updated whenever the page count increases.

When accessing the same `payload.data` from [ssrcontext](#ssrcontext), you can access the same value on the server side as well.

- **state** (object) - When you use `useState` composable in Nuxt to set shared state, this state data is accessed through `payload.state.[name-of-your-state]`.

```js [plugins/my-plugin.ts]
export const useColor = () => useState<string>('color', () => 'pink')

export default defineNuxtPlugin((nuxtApp) => {
  if (process.server) {
    const color = useColor()
  }
})
```

### `isHydrating`

Use `nuxtApp.isHydrating` (boolean) to check if the Nuxt app is hydrating on the client side.

**Example:**

```ts [components/nuxt-error-boundary.ts]
export default defineComponent({
  setup (_props, { slots, emit }) {
    const nuxtApp = useNuxtApp()
    onErrorCaptured((err) => {
      if (process.client && !nuxtApp.isHydrating) {
        // ...
      }
    })
  }
})
```
