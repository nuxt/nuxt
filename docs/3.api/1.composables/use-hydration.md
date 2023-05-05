# `useHydration`

Allows complete control of the hydration cycle to set and receive data from the server.

`useHydration` is a built-in composable that provides a way to set data on the server side every time a new HTTP request gets made and receives that data on the client side. This way, `useHydration` allows complete control of the hydration cycle.

## Type

```ts [signature]
useHydration <T> (key: string, get: () => T, set: (value: T) => void) => {}
```

The `useHydration()` composable is usable within composables, plugins, and components.

`useHydration` accepts three parameters:

- `key`

  **Type**: `String`

  `key` is a unique key that identifies the data in your Nuxt application.

- `get`

  **Type**: `Function`

  `get` is a function that returns the value to set the initial data.

- `set`

  **Type**: `Function`

  `set` is a function that receives the data on the client-side

Once the initial data gets returned using the `get` function on the server side, you can access that data within `nuxtApp.payload` using the unique key passed as the first parameter in the `useHydration` composable.

::ReadMore{link="/docs/getting-started/data-fetching"}
::
