# `useNuxtApp`

`useNuxtApp` is a built-in composable that provides a way to access the shared runtime context of Nuxt, which is available on both the client and server sides. It helps you access the Vue app instance, runtime hooks, runtime config variables, and internal states, such as `ssrContext` and `payload`.

The `useNuxtApp()` composable is usable within composables, plugins, and components.

```vue [app.vue]
<script setup>
  const nuxtApp = useNuxtApp()
</script>
```

## Methods

### `provide (name, value)`

`nuxtApp` is a runtime context you can extend using [Nuxt plugins](/docs/guide/directory-structure/plugins). Use the `provide` function to create Nuxt plugins to make values and helper methods available in your Nuxt application across all composables and components.

The `provide` function accepts `name` and `value` parameters.

**Example:**

```js
const nuxtApp = useNuxtApp()
nuxtApp.provide('hello', (name) => `Hello ${name}!`)

// Prints "Hello name!"
console.log(nuxtApp.$hello('name'))
```

As you can see in the example above, `$hello` has become the new and custom part of the `nuxtApp` context, and it is available in all places where `nuxtApp` is accessible.

### `hook(name, cb)`

Hooks available in `nuxtApp` allow you to customize the runtime aspects of your Nuxt application. You can use runtime hooks in Vue.js composables and [Nuxt plugins](/docs/guide/directory-structure/plugins) to hook into the rendering lifecycle.

The `hook` function is practical for adding custom logic by hooking into the rendering lifecycle at a specific point. Most of the time, the `hook` function gets used when creating Nuxt plugins.

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

`useNuxtApp()` exposes the following properties that you can use to extend and customize your app and share state, data, and variables.

### `vueApp`

`vueApp` is the global Vue.js [application instance](https://vuejs.org/api/application.html#application-api) that you can access through `nuxtApp`. Some useful methods:

- [**component()**](https://vuejs.org/api/application.html#app-component) - Registers a global component if passing both a name string and a component definition or retrieves an already registered one if only a name.
- [**directive()**](https://vuejs.org/api/application.html#app-directive) - Registers a global custom directive if passing both a name string and a directive definition or retrieves an already registered one if only the name is passed[(example)](/docs/guide/directory-structure/plugins#vue-directives).
- [**use()**](https://vuejs.org/api/application.html#app-use) - Installs a **[Vue.js Plugin](https://vuejs.org/guide/reusability/plugins.html)** [(example)](/docs/guide/directory-structure/plugins#vue-plugins).

:ReadMore{link="https://vuejs.org/api/application.html#application-api"}

### `ssrContext`

`ssrContext` is generated during server-side rendering and is only available on the server side. Nuxt exposes the following properties through `ssrContext`:

- **`url`** (string) -  Current request url.
- **`event`** ([unjs/h3](https://github.com/unjs/h3) request event) - Access to `req` and `res` objects for the current request.
- **`payload`** (object) - NuxtApp payload object.

### `payload`

`payload` exposes data and state variables from the server to the client side. The following keys will be available on the client after being passed from the server side:

- **serverRendered** (boolean) - Indicates if a response is server-side-rendered.
- **data** (object) - When you fetch the data from an API endpoint using either `useFetch` or `useAsyncData`, the resulting payload is accessible from the `payload.data`. This data is cached and helps you prevent fetching the same data if an identical request is triggered more than once.

```vue [app.vue]
export default defineComponent({
  async setup() {
    const { data } = await useAsyncData('count', () => $fetch('/api/count'))
  }
})
```

After fetching the value of `count` using `useAsyncData` in the example above, if you access `payload.data`, you will see `{ count: 1 }` recorded there. The value of `count` is updated whenever the page count increases.

When accessing the same `payload.data` from [ssrcontext](#ssrcontext), you can also access the same value on the server side.

- **state** (object) - When you use `useState` composable in Nuxt to set shared state, this state's data gets accessed through `payload.state.[name-of-your-state]`.

```js [plugins/my-plugin.ts]
export const useColor = () => useState<string>('color', () => 'pink')

export default defineNuxtPlugin((nuxtApp) => {
  if (process.server) {
    const color = useColor()
  }
})
```

::alert
`payload` must normally contain only plain JavaScript objects. But by setting `experimental.renderJsonPayloads`, it is possible to use more advanced types, such as `ref`, `reactive`, `shallowRef`, `shallowReactive`, and `NuxtError`.

You can also add custom types with a unique plugin helper:

```ts [plugins/custom-payload.ts]
  /**
   * This plugin runs very early in the Nuxt lifecycle before we revive the payload.
   * You will not have access to the router or other Nuxt-injected properties.
   */
export default definePayloadPlugin((nuxtApp) => {
  definePayloadReducer('BlinkingText', data => data === '<blink>' && '_')
  definePayloadReviver('BlinkingText', () => '<blink>')
})
```

::

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
